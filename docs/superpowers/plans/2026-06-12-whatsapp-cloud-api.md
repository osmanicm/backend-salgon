# Envío real por WhatsApp Cloud API (v1 saliente) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el botón "Enviar" de `/whatsapp` mande de verdad plantillas aprobadas de Meta a los leads vía WhatsApp Cloud API (texto + opcional 1 documento/imagen en header), con registro de auditoría.

**Architecture:** Una server function (patrón `notifications.functions.ts`/`assistant.functions.ts`) hace el envío server-side leyendo secrets de Cloudflare; el cliente nunca toca el token de Meta. La tabla `whatsapp_templates` se extiende con metadatos de Meta (nombre/idioma/header/mapeo de variables); una tabla `whatsapp_messages` registra cada envío. El admin captura el vínculo Meta en `/whatsapp-templates`; `/whatsapp` resuelve variables desde el lead + inputs manuales y llama a la server fn.

**Tech Stack:** TanStack React Start server functions, WhatsApp Cloud API (Graph API), Supabase (RLS), Zod, Cloudflare Workers (secrets vía wrangler), React Query.

**Spec de referencia:** `docs/superpowers/specs/2026-06-11-whatsapp-cloud-api-design.md`

**Estado de onboarding (confirmado):** El usuario YA tiene `WHATSAPP_PHONE_NUMBER_ID` y un access token (System User). FALTAN plantillas aprobadas. → El pipeline real se valida con la plantilla pre-aprobada **`hello_world`** (idioma `en_US`, sin variables, sin header) que Meta provee por defecto; las plantillas propias se registran cuando Meta las apruebe.

**Nota de testing:** El proyecto no tiene runner de unit tests (solo Playwright E2E + manual). Verificación: `tsc`/`eslint`, prueba de envío real con `hello_world` a un número de prueba, y prueba manual del flujo en la app.

**⚠️ Entorno:** Un solo proyecto Supabase (`hlqmfwqeildvbokawngt`); la migración impacta producción. Secrets de WhatsApp se ponen vía `wrangler secret put` (prod) y `.env` (dev).

---

## File Structure

- **Create:** `supabase/migrations/20260612210000_whatsapp_send.sql` — extiende `whatsapp_templates`; crea `whatsapp_messages` (log) + RLS.
- **Modify:** `src/integrations/supabase/types.ts` — regenerar.
- **Create:** `src/lib/whatsapp.functions.ts` — server fn `sendWhatsappTemplate` (Graph API, upload de media, mapeo de errores, log).
- **Modify:** `src/data/whatsappTemplatesApi.ts` — incluir campos Meta en tipos/mutations.
- **Modify:** `src/routes/whatsapp-templates.tsx` — form admin: campos Meta + repeater de mapeo de variables.
- **Modify:** `src/routes/whatsapp.tsx` — envío estructurado real (selector lead+plantilla, resolución de variables, 1 media opcional, llamar server fn).
- **Modify:** `.env.example` — documentar secrets de WhatsApp.
- **Create:** `docs/whatsapp-onboarding.md` — pasos de Meta (referencia).

---

### Task 1: Migración — extender templates + log de envíos

**Files:**
- Create: `supabase/migrations/20260612210000_whatsapp_send.sql`

- [ ] **Step 1: Escribir la migración**

Crear el archivo con exactamente:

```sql
-- WhatsApp Cloud API: vincular plantillas a Meta + log de envíos

-- 1) Extender whatsapp_templates con metadatos de Meta
alter table public.whatsapp_templates
  add column if not exists meta_template_name text,
  add column if not exists meta_language text not null default 'es_MX',
  add column if not exists header_format text not null default 'NONE'
    check (header_format in ('NONE','TEXT','IMAGE','DOCUMENT')),
  add column if not exists variable_mapping jsonb not null default '[]'::jsonb;

-- 2) Log de envíos (auditoría)
create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  template_id uuid references public.whatsapp_templates(id) on delete set null,
  to_phone text not null,
  meta_message_id text,
  status text not null,            -- 'sent' | 'error'
  error text,
  sent_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index whatsapp_messages_created_idx on public.whatsapp_messages(created_at desc);

alter table public.whatsapp_messages enable row level security;

-- Lectura para autenticados (auditoría del equipo). Inserción solo vía service-role
-- (la server function), por lo que no hay política de insert para authenticated.
create policy "WhatsApp messages: authenticated read"
  on public.whatsapp_messages for select to authenticated
  using (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260612210000_whatsapp_send.sql
git commit -m "feat(whatsapp): extender plantillas con metadatos Meta + log de envíos"
```

---

### Task 2: Aplicar migración + regenerar tipos (controlador)

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Aplicar** vía MCP Supabase `apply_migration` (`project_id = hlqmfwqeildvbokawngt`, `name = whatsapp_send`, `query` = contenido de Task 1). Expected: `{"success": true}`.

- [ ] **Step 2: Verificar** vía MCP `execute_sql`:
```sql
select column_name from information_schema.columns
where table_name='whatsapp_templates' and column_name in ('meta_template_name','meta_language','header_format','variable_mapping')
order by column_name;
select count(*) as has_table from information_schema.tables where table_name='whatsapp_messages';
```
Expected: 4 columnas nuevas + `has_table = 1`.

- [ ] **Step 3: Regenerar tipos** vía MCP `generate_typescript_types` y sobrescribir `src/integrations/supabase/types.ts`. Verificar: `grep -c "whatsapp_messages" src/integrations/supabase/types.ts` > 0.

- [ ] **Step 4: Type-check + commit**
```bash
node_modules/.bin/tsc --noEmit
git add src/integrations/supabase/types.ts
git commit -m "chore(types): regenerar tipos Supabase (whatsapp_messages + meta cols)"
```

---

### Task 3: Server function `sendWhatsappTemplate`

**Files:**
- Create: `src/lib/whatsapp.functions.ts`

- [ ] **Step 1: Crear el archivo** con exactamente:

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH_VERSION = process.env.WHATSAPP_API_VERSION || "v22.0";

const InputSchema = z.object({
  templateId: z.string().uuid(),
  toPhone: z.string().min(8).max(20),
  variables: z.array(z.string()).max(10).default([]),
  media: z
    .object({
      kind: z.enum(["image", "document"]),
      dataUrl: z.string(),
      filename: z.string().max(200),
      mimeType: z.string().max(100),
    })
    .nullable()
    .optional(),
  leadId: z.string().uuid().nullable().optional(),
});

/** Normaliza a dígitos con código de país (MX por defecto). Cloud API espera dígitos sin '+'. */
function normalizeMxPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return "52" + digits; // local MX → +52
  if (digits.length >= 11 && digits.length <= 15) return digits; // ya trae código de país
  return null;
}

function friendlyMetaError(status: number, code: number | undefined, message: string): string {
  if (code === 132001 || /template/i.test(message))
    return "La plantilla no existe o no está aprobada en Meta. Revisa el nombre y el idioma.";
  if (code === 131030 || /allowed list/i.test(message))
    return "El número no está en la lista permitida de Meta (modo pruebas). Agrégalo o pasa la app a producción.";
  if (code === 131026 || /undeliverable/i.test(message))
    return "El mensaje no se pudo entregar a ese número (¿tiene WhatsApp?).";
  if (code === 100 || status === 400)
    return "Parámetros inválidos en el envío. Revisa las variables de la plantilla.";
  if (status === 401 || status === 403) return "Token de WhatsApp inválido o sin permisos.";
  if (status === 429) return "Límite de envíos alcanzado. Intenta más tarde.";
  return "No se pudo enviar el mensaje por WhatsApp.";
}

async function uploadMedia(
  token: string,
  phoneId: string,
  media: { dataUrl: string; filename: string; mimeType: string },
): Promise<{ id?: string; error?: string }> {
  const base64 = media.dataUrl.includes(",") ? media.dataUrl.split(",")[1] : media.dataUrl;
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([bytes], { type: media.mimeType }), media.filename);
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok) return { error: json?.error?.message || "upload failed" };
  return { id: json.id };
}

export const sendWhatsappTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
      return { ok: false as const, error: "WhatsApp no está configurado (faltan secrets)." };
    }
    const { supabase, userId } = context as {
      supabase: { from: (t: string) => any };
      userId: string;
    };

    const { data: tpl, error: tplErr } = await supabase
      .from("whatsapp_templates")
      .select("id, name, meta_template_name, meta_language, header_format")
      .eq("id", data.templateId)
      .is("deleted_at", null)
      .maybeSingle();
    if (tplErr) return { ok: false as const, error: tplErr.message };
    if (!tpl) return { ok: false as const, error: "Plantilla no encontrada." };
    if (!tpl.meta_template_name)
      return { ok: false as const, error: "La plantilla no está vinculada a Meta (falta el nombre de plantilla aprobada)." };

    const to = normalizeMxPhone(data.toPhone);
    if (!to) return { ok: false as const, error: "Teléfono inválido." };

    const components: unknown[] = [];

    if (tpl.header_format === "IMAGE" || tpl.header_format === "DOCUMENT") {
      if (!data.media)
        return { ok: false as const, error: "Esta plantilla requiere un archivo en el encabezado." };
      const up = await uploadMedia(token, phoneId, data.media);
      if (up.error || !up.id)
        return { ok: false as const, error: "No se pudo subir el archivo a WhatsApp: " + (up.error ?? "") };
      const kind = tpl.header_format === "IMAGE" ? "image" : "document";
      const mediaParam =
        kind === "document"
          ? { type: "document", document: { id: up.id, filename: data.media.filename } }
          : { type: "image", image: { id: up.id } };
      components.push({ type: "header", parameters: [mediaParam] });
    }

    if (data.variables.length > 0) {
      components.push({
        type: "body",
        parameters: data.variables.map((v) => ({ type: "text", text: v })),
      });
    }

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: tpl.meta_template_name,
        language: { code: tpl.meta_language || "es_MX" },
        ...(components.length ? { components } : {}),
      },
    };

    let metaMessageId: string | null = null;
    let sendError: string | null = null;
    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        messages?: { id?: string }[];
        error?: { code?: number; message?: string };
      };
      if (!res.ok) {
        console.error("WhatsApp send error", res.status, JSON.stringify(json));
        sendError = friendlyMetaError(res.status, json?.error?.code, json?.error?.message ?? "");
      } else {
        metaMessageId = json?.messages?.[0]?.id ?? null;
      }
    } catch (e) {
      console.error("WhatsApp fetch failed", e);
      sendError = "No se pudo contactar a WhatsApp.";
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("whatsapp_messages").insert({
        lead_id: data.leadId ?? null,
        template_id: tpl.id,
        to_phone: to,
        meta_message_id: metaMessageId,
        status: sendError ? "error" : "sent",
        error: sendError,
        sent_by: userId,
      });
    } catch (e) {
      console.error("WhatsApp log failed", e);
    }

    if (sendError) return { ok: false as const, error: sendError };
    return { ok: true as const, messageId: metaMessageId };
  });
```

- [ ] **Step 2: Type-check + commit**
```bash
node_modules/.bin/tsc --noEmit
git add src/lib/whatsapp.functions.ts
git commit -m "feat(whatsapp): server fn sendWhatsappTemplate (Cloud API)"
```

---

### Task 4: Extender la capa de datos de plantillas

**Files:**
- Modify: `src/data/whatsappTemplatesApi.ts`

- [ ] **Step 1: Ampliar el tipo de input de create/update**

En `src/data/whatsappTemplatesApi.ts`, reemplazar la firma del `mutationFn` de `useCreateWhatsappTemplate` (línea 29) de:
```ts
    mutationFn: async (input: { name: string; body: string }) => {
```
a:
```ts
    mutationFn: async (input: WhatsappTemplateInsert) => {
```
(`WhatsappTemplateInsert` ya está exportado y ahora incluye las columnas Meta nuevas; `useUpdateWhatsappTemplate` ya usa `WhatsappTemplateUpdate`, sin cambios.)

- [ ] **Step 2: Type-check + commit**
```bash
node_modules/.bin/tsc --noEmit
git add src/data/whatsappTemplatesApi.ts
git commit -m "feat(whatsapp): aceptar metadatos Meta al crear plantillas"
```

---

### Task 5: Form admin — campos Meta + mapeo de variables

**Files:**
- Modify: `src/routes/whatsapp-templates.tsx`

- [ ] **Step 1: Ampliar el schema y el estado del form**

Reemplazar el `templateSchema` (líneas 61-64) por:
```ts
const VAR_SOURCES = ["lead.name", "lead.phone", "lead.email", "manual"] as const;

const varMapSchema = z.object({
  source: z.enum(VAR_SOURCES),
  label: z.string().max(60).optional().default(""),
});

const templateSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto").max(80),
  body: z.string().trim().min(2, "El mensaje es demasiado corto").max(2000),
  meta_template_name: z.string().trim().max(120).optional().default(""),
  meta_language: z.string().trim().min(2).max(10).default("es_MX"),
  header_format: z.enum(["NONE", "TEXT", "IMAGE", "DOCUMENT"]).default("NONE"),
  variable_mapping: z.array(varMapSchema).max(10).default([]),
});
```

- [ ] **Step 2: Reemplazar el cuerpo del componente `TemplateFormDialog`**

Reemplazar TODO el componente `TemplateFormDialog` (de `function TemplateFormDialog({` línea 195 hasta su cierre `}` en línea 300) por:

```tsx
function TemplateFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: WhatsappTemplateRow;
}) {
  const isEdit = !!initial;
  const create = useCreateWhatsappTemplate();
  const update = useUpdateWhatsappTemplate();
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [metaName, setMetaName] = useState("");
  const [metaLang, setMetaLang] = useState("es_MX");
  const [headerFormat, setHeaderFormat] = useState<"NONE" | "TEXT" | "IMAGE" | "DOCUMENT">("NONE");
  const [varMap, setVarMap] = useState<{ source: string; label: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setName(initial?.name ?? "");
    setBody(initial?.body ?? "");
    setMetaName(initial?.meta_template_name ?? "");
    setMetaLang(initial?.meta_language ?? "es_MX");
    setHeaderFormat(
      (initial?.header_format as "NONE" | "TEXT" | "IMAGE" | "DOCUMENT") ?? "NONE",
    );
    setVarMap(
      Array.isArray(initial?.variable_mapping)
        ? (initial!.variable_mapping as { source: string; label: string }[])
        : [],
    );
  }, [open, initial]);

  const pending = create.isPending || update.isPending;

  async function save() {
    setError(null);
    const parsed = templateSchema.safeParse({
      name,
      body,
      meta_template_name: metaName,
      meta_language: metaLang,
      header_format: headerFormat,
      variable_mapping: varMap,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" · "));
      return;
    }
    try {
      const payload = {
        name: parsed.data.name,
        body: parsed.data.body,
        meta_template_name: parsed.data.meta_template_name || null,
        meta_language: parsed.data.meta_language,
        header_format: parsed.data.header_format,
        variable_mapping: parsed.data.variable_mapping,
      };
      if (isEdit && initial) {
        await update.mutateAsync({ id: initial.id, patch: payload });
        toast.success("Plantilla actualizada");
      } else {
        await create.mutateAsync(payload);
        toast.success("Plantilla creada");
      }
      onOpenChange(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error al guardar";
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
          <DialogDescription>
            Vincula esta plantilla con una aprobada en Meta. El cuerpo es solo vista previa interna.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Nombre (interno) *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bienvenida" maxLength={80} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre de plantilla en Meta</Label>
              <Input value={metaName} onChange={(e) => setMetaName(e.target.value)} placeholder="hello_world" maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label>Idioma (código Meta)</Label>
              <Input value={metaLang} onChange={(e) => setMetaLang(e.target.value)} placeholder="es_MX" maxLength={10} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Encabezado (header)</Label>
            <select
              value={headerFormat}
              onChange={(e) => setHeaderFormat(e.target.value as "NONE" | "TEXT" | "IMAGE" | "DOCUMENT")}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="NONE">Sin encabezado</option>
              <option value="TEXT">Texto</option>
              <option value="IMAGE">Imagen</option>
              <option value="DOCUMENT">Documento</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Variables del cuerpo ({"{{1}}, {{2}}…"})</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setVarMap((v) => [...v, { source: "lead.name", label: "" }])}
              >
                <Plus className="h-3.5 w-3.5" /> Agregar
              </Button>
            </div>
            {varMap.length === 0 && (
              <p className="text-xs text-muted-foreground">Sin variables (plantilla de texto fijo).</p>
            )}
            <div className="space-y-2">
              {varMap.map((vm, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10 shrink-0">{`{{${i + 1}}}`}</span>
                  <select
                    value={vm.source}
                    onChange={(e) =>
                      setVarMap((arr) => arr.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)))
                    }
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm flex-1"
                  >
                    <option value="lead.name">Nombre del lead</option>
                    <option value="lead.phone">Teléfono del lead</option>
                    <option value="lead.email">Email del lead</option>
                    <option value="manual">Manual (se escribe al enviar)</option>
                  </select>
                  {vm.source === "manual" && (
                    <Input
                      value={vm.label}
                      onChange={(e) =>
                        setVarMap((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                      }
                      placeholder="Etiqueta (ej. Propiedad)"
                      className="h-9 flex-1"
                      maxLength={60}
                    />
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive shrink-0"
                    aria-label="Quitar variable"
                    onClick={() => setVarMap((arr) => arr.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Vista previa interna</Label>
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Hola {{name}}, …" required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {pending ? (isEdit ? "Guardando…" : "Creando…") : isEdit ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Type-check, lint y commit**
```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint src/routes/whatsapp-templates.tsx
git add src/routes/whatsapp-templates.tsx
git commit -m "feat(whatsapp): admin captura metadatos Meta y mapeo de variables"
```

---

### Task 6: Reescribir `/whatsapp` para envío real

**Files:**
- Modify: `src/routes/whatsapp.tsx`

- [ ] **Step 1: Reemplazar el archivo completo** `src/routes/whatsapp.tsx` por:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Send, MessageCircle, FileText, X, ImagePlus, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeads } from "@/data/leadsApi";
import { useWhatsappTemplates, type WhatsappTemplateRow } from "@/data/whatsappTemplatesApi";
import { blobToDataUrl } from "@/data/whatsappHandoff";
import { sendWhatsappTemplate } from "@/lib/whatsapp.functions";
import { getAuthHeaders } from "@/lib/serverFnAuth";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";
import { toast } from "sonner";

const MAX_MEDIA_BYTES = 5 * 1024 * 1024;

export const Route = createFileRoute("/whatsapp")({
  component: WhatsappPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="WhatsApp" error={error} reset={reset} />,
});

type VarMap = { source: string; label?: string };

function getVarMapping(t: WhatsappTemplateRow | undefined): VarMap[] {
  if (!t || !Array.isArray(t.variable_mapping)) return [];
  return t.variable_mapping as VarMap[];
}

function WhatsappPage() {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: templates = [], isLoading: templatesLoading } = useWhatsappTemplates();
  const send = useServerFn(sendWhatsappTemplate);

  const [leadId, setLeadId] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [manualVars, setManualVars] = useState<Record<number, string>>({});
  const [media, setMedia] = useState<{ kind: "image" | "document"; dataUrl: string; filename: string; mimeType: string } | null>(null);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedLead = leads.find((l) => l.id === leadId);
  const template = templates.find((t) => t.id === templateId);
  const mapping = getVarMapping(template);
  const needsMedia = template?.header_format === "IMAGE" || template?.header_format === "DOCUMENT";

  useEffect(() => {
    if (!leadId && leads.length > 0) setLeadId(leads[0].id);
  }, [leads, leadId]);
  useEffect(() => {
    if (!templateId && templates.length > 0) setTemplateId(templates[0].id);
  }, [templates, templateId]);
  useEffect(() => {
    setManualVars({});
    setMedia(null);
  }, [templateId]);

  function resolveVar(vm: VarMap, index: number): string {
    if (vm.source === "lead.name") return selectedLead?.name ?? "";
    if (vm.source === "lead.phone") return selectedLead?.phone ?? "";
    if (vm.source === "lead.email") return selectedLead?.email ?? "";
    return manualVars[index] ?? "";
  }

  const resolvedVars = mapping.map((vm, i) => resolveVar(vm, i));

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_MEDIA_BYTES) {
      toast.error("El archivo supera 5 MB");
      return;
    }
    const isImage = f.type.startsWith("image/");
    if (template?.header_format === "IMAGE" && !isImage) {
      toast.error("Esta plantilla requiere una imagen");
      return;
    }
    try {
      const dataUrl = await blobToDataUrl(f);
      setMedia({
        kind: template?.header_format === "IMAGE" ? "image" : "document",
        dataUrl,
        filename: f.name,
        mimeType: f.type || "application/octet-stream",
      });
    } catch {
      toast.error("No se pudo leer el archivo");
    }
  }

  async function doSend() {
    if (sending) return;
    const phone = altPhone.trim() || selectedLead?.phone || "";
    if (!phone) {
      toast.error("No hay teléfono destino (selecciona un lead o escribe uno).");
      return;
    }
    if (!template) {
      toast.error("Selecciona una plantilla.");
      return;
    }
    if (!template.meta_template_name) {
      toast.error("La plantilla no está vinculada a Meta. Pide a un admin completarla en Configuración.");
      return;
    }
    if (needsMedia && !media) {
      toast.error("Esta plantilla requiere adjuntar un archivo.");
      return;
    }
    const missing = mapping.findIndex((vm, i) => resolveVar(vm, i).trim() === "");
    if (missing >= 0) {
      toast.error(`Falta el valor de la variable {{${missing + 1}}}.`);
      return;
    }
    setSending(true);
    try {
      const res = await send({
        data: {
          templateId: template.id,
          toPhone: phone,
          variables: resolvedVars,
          media: needsMedia ? media : null,
          leadId: leadId || null,
        },
        headers: await getAuthHeaders(),
      });
      if (res.ok) {
        toast.success("Mensaje enviado por WhatsApp", { description: res.messageId ? `ID: ${res.messageId}` : undefined });
        setMedia(null);
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  return (
    <AppShell title="Integración con WhatsApp" subtitle="Envía plantillas aprobadas a tus prospectos">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PageCard title="Plantillas" description="Selecciona una plantilla aprobada" className="lg:col-span-1">
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setTemplateId(t.id)}
                  className={
                    "w-full text-left rounded-lg border p-3 transition-colors " +
                    (t.id === templateId ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50")
                  }
                >
                  <div className="text-sm font-medium flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-success" />
                    {t.name}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.body}</div>
                  {!t.meta_template_name && (
                    <div className="text-[10px] text-destructive mt-1">Sin vincular a Meta</div>
                  )}
                </button>
              </li>
            ))}
            {templatesLoading && <li className="text-center text-xs text-muted-foreground py-6">Cargando…</li>}
            {!templatesLoading && templates.length === 0 && (
              <li className="text-center text-xs text-muted-foreground py-6">
                No hay plantillas. Un admin puede crearlas en Configuración.
              </li>
            )}
          </ul>
        </PageCard>

        <PageCard title="Enviar mensaje" description="Las variables se llenan desde el prospecto" className="lg:col-span-2">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Destinatario</Label>
                <Select value={leadId} onValueChange={setLeadId} disabled={leadsLoading || leads.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={leadsLoading ? "Cargando…" : "Selecciona un prospecto"} />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} — {l.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono (alterno)</Label>
                <Input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} placeholder="+52 …" />
              </div>
            </div>

            {mapping.length > 0 && (
              <div className="space-y-2">
                <Label>Variables</Label>
                {mapping.map((vm, i) => {
                  const isManual = vm.source === "manual";
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-10 shrink-0">{`{{${i + 1}}}`}</span>
                      {isManual ? (
                        <Input
                          value={manualVars[i] ?? ""}
                          onChange={(e) => setManualVars((m) => ({ ...m, [i]: e.target.value }))}
                          placeholder={vm.label || "Valor"}
                        />
                      ) : (
                        <Input value={resolveVar(vm, i)} disabled className="bg-muted/50" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {needsMedia && (
              <div className="space-y-1.5">
                <Label>{template?.header_format === "IMAGE" ? "Imagen del encabezado" : "Documento del encabezado"}</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={template?.header_format === "IMAGE" ? "image/*" : "*/*"}
                  className="hidden"
                  onChange={handleFile}
                />
                {media ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                    <div className="h-9 w-9 rounded-md bg-success/10 text-success grid place-items-center">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0 text-sm truncate">{media.filename}</div>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Quitar" onClick={() => setMedia(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button type="button" variant="outline" className="gap-1.5" onClick={() => fileInputRef.current?.click()}>
                    <ImagePlus className="h-4 w-4" /> Adjuntar archivo
                  </Button>
                )}
              </div>
            )}

            <div className="rounded-xl bg-[oklch(0.96_0.04_150)] p-4">
              <div className="ml-auto max-w-sm rounded-2xl rounded-br-sm bg-success text-success-foreground px-3 py-2 text-sm shadow-[var(--shadow-soft)] space-y-2">
                <div className="whitespace-pre-wrap break-words">
                  {template?.body || "Selecciona una plantilla"}
                </div>
                {mapping.length > 0 && (
                  <div className="text-[10px] opacity-80">Variables: {resolvedVars.map((v) => v || "—").join(" · ")}</div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={doSend} className="gap-1.5" disabled={sending}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar por WhatsApp
              </Button>
            </div>
          </div>
        </PageCard>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Type-check, lint y commit**
```bash
node_modules/.bin/tsc --noEmit
node_modules/.bin/eslint src/routes/whatsapp.tsx
git add src/routes/whatsapp.tsx
git commit -m "feat(whatsapp): envío real estructurado de plantillas"
```

---

### Task 7: Secrets, env y doc de onboarding

**Files:**
- Modify: `.env.example`
- Create: `docs/whatsapp-onboarding.md`

- [ ] **Step 1: Documentar secrets en `.env.example`**

Agregar al final de `.env.example`:
```
# WhatsApp Cloud API (Meta)
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_API_VERSION=v22.0
```

- [ ] **Step 2: Crear `docs/whatsapp-onboarding.md`**

```markdown
# WhatsApp Cloud API — Onboarding (Meta)

Prerrequisitos para que `/whatsapp` envíe de verdad.

## 1. App y número
1. En Meta Business → producto **WhatsApp** → obtén el **Phone Number ID** y el **WhatsApp Business Account (WABA) ID**.
2. Crea un **System User** con un **token permanente** y permiso `whatsapp_business_messaging`.

## 2. Secrets en el CRM
- Dev: en `.env` → `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION=v22.0`.
- Prod (Cloudflare): `wrangler secret put WHATSAPP_ACCESS_TOKEN` y `wrangler secret put WHATSAPP_PHONE_NUMBER_ID`.

## 3. Plantillas
1. En Meta Business → **Message Templates**, crea y envía a aprobación tus plantillas (cuerpo con variables `{{1}}`, `{{2}}`; si llevan archivo, header tipo IMAGE o DOCUMENT).
2. Anota el **nombre exacto** y el **idioma** (`es_MX`).
3. En el CRM → Configuración → **Plantillas de WhatsApp**, registra el nombre Meta, idioma, header y el mapeo de variables.

## 4. Pruebas
- Meta provee `hello_world` (idioma `en_US`, sin variables) pre-aprobada → úsala para validar el pipeline antes de tener tus plantillas.
- En modo de pruebas, agrega los números destino a la lista permitida de la app.
```

- [ ] **Step 3: Commit**
```bash
git add .env.example docs/whatsapp-onboarding.md
git commit -m "docs(whatsapp): secrets y guía de onboarding de Meta"
```

---

### Task 8: Configurar secrets + verificación (controlador + usuario)

**Files:**
- (configuración + pruebas)

- [ ] **Step 1: Secrets en dev** — el usuario agrega a `.env` su `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID` reales (no se commitea).

- [ ] **Step 2: Registrar la plantilla de prueba** — en `/whatsapp-templates`, crear una plantilla: Nombre "Prueba hello_world", Nombre Meta `hello_world`, Idioma `en_US`, Header `NONE`, sin variables, cuerpo "Hello World".

- [ ] **Step 3: Smoke test del pipeline real (dev)** — `bun run dev`; en `/whatsapp` seleccionar un lead cuyo número esté en la lista permitida de Meta (o usar el campo "alterno"), elegir "Prueba hello_world", Enviar. Expected: toast "Mensaje enviado" con ID; el mensaje llega al WhatsApp del número. Verificar fila en `whatsapp_messages` (status 'sent', meta_message_id no nulo).

- [ ] **Step 4: Verificar manejo de error** — enviar a un número NO permitido (modo pruebas). Expected: toast con mensaje amable (lista permitida / no entregable); fila en `whatsapp_messages` con status 'error'.

- [ ] **Step 5: Secrets en prod + deploy** (cuando el smoke test pase):
```
wrangler secret put WHATSAPP_ACCESS_TOKEN
wrangler secret put WHATSAPP_PHONE_NUMBER_ID
bun run build
```
```powershell
(Get-Content dist/server/wrangler.json) -replace '"workers_dev":false', '"workers_dev":true' | Set-Content dist/server/wrangler.json
```
```
npx wrangler deploy
```

---

## Self-Review

**Spec coverage:**
- Server fn server-side, secrets nunca en cliente → Task 3.
- Secrets `WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID/API_VERSION` + validación → Task 3 Step 1, Task 7, Task 8.
- Extender `whatsapp_templates` (meta_template_name, meta_language, header_format, variable_mapping) → Task 1.
- Tabla `whatsapp_messages` (log) + RLS → Task 1.
- Resolver plantilla, normalizar E.164, upload media a Meta, componer template, POST messages, mapear errores, log → Task 3.
- Auth/activo: `requireSupabaseAuth` (igual que el resto) → Task 3.
- Admin captura vínculo Meta + mapeo → Task 5.
- `/whatsapp`: envío estructurado, variables desde lead + manuales, 1 media para header, teléfono alterno cableado, sin galería multi-foto → Task 6.
- Doc de onboarding → Task 7.
- Pruebas (mock no aplica por seroval; prueba real con hello_world + manual) → Task 8.
- Fuera de alcance (webhook, acuses, galería, sync de plantillas) → respetado.

**Placeholder scan:** Sin TBD/TODO; SQL/TS/TSX completos. ✅

**Type/identifier consistency:** `sendWhatsappTemplate` input (`templateId, toPhone, variables, media{kind,dataUrl,filename,mimeType}, leadId`) coincide entre server fn (Task 3) y llamada del cliente (Task 6). `header_format` valores NONE/TEXT/IMAGE/DOCUMENT consistentes (migración, form, server fn, cliente). `variable_mapping` como arreglo `{source,label}` consistente (form Task 5 ↔ cliente Task 6). `getAuthHeaders` y `useServerFn` igual que `AssistantWidget`. ✅

**Nota:** `blobToDataUrl` se reutiliza de `whatsappHandoff.ts` (ya existe). El handoff desde Disponibilidad (PDF) queda compatible solo si su plantilla destino tiene header DOCUMENT; integrarlo finamente queda como ajuste menor posterior (no rompe nada: el envío exige plantilla vinculada).

Sin huecos detectados.
