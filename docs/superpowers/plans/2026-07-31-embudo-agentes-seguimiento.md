# Embudo de Ventas para Agentes + Seguimiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a los agentes acceso al Embudo de Ventas (`/pipeline`) acotado a sus propios prospectos, y permitir seguimiento desde la tarjeta (fecha de "próximo contacto" + nota).

**Architecture:** El embudo ya es un Kanban sobre `useLeads()`/`useUpdateLead()` acotados por RLS. El acceso se abre quitando el candado de ruta y sumando navegación (patrón idéntico a [[leads-agent-access]]). El seguimiento agrega una columna `next_contact_at date` a `leads` y un Popover editor en la tarjeta que persiste vía el mutation existente. Cero cambios de políticas RLS.

**Tech Stack:** TanStack Router, React Query, `@dnd-kit`, shadcn/ui (Popover, Calendar, Textarea), Supabase (Postgres + RLS), Playwright E2E, Cloudflare Workers.

## Global Constraints

- Rama de trabajo: `feat/pipeline-agent-access` (ya creada; spec ya comiteado).
- **Cero cambios de políticas RLS.** Las políticas por fila de `leads` (`agent_id = auth.uid() OR has_role(admin)`) ya cubren todas las columnas.
- Proyecto Supabase: `hlqmfwqeildvbokawngt`. Migraciones en `supabase/migrations/`.
- Archivos usan **CRLF**; ESLint/Prettier esperan LF (ruido `␍` preexistente). NO reformatear archivos completos.
- UI en español (es-MX). Fechas en formato corto es-MX (día + mes abreviado).
- Sin runner de tests unitarios: los ciclos de prueba son **simulación RLS por SQL**, **E2E Playwright** (proyecto `chromium-agent`, requiere `E2E_AGENT_PASSWORD='Salgon2026!'`) y **`bun run build` + `bunx tsc --noEmit`**.
- Resaltado "vencido": `next_contact_at < hoy` **y** `status !== "Closed"`.
- IDs de prueba: agente osmanicm = `a78f2f12-ab1d-40c4-8b37-32b131ce4bfc`; admin = `f0be43d1-90da-4626-b20f-593079eb616a`.

---

## File Structure

- `supabase/migrations/20260731120000_leads_next_contact.sql` — **crear**: agrega `next_contact_at date` a `leads`.
- `src/integrations/supabase/types.ts` — **modificar** (regenerado): incluye `next_contact_at`.
- `src/components/layout/AppShell.tsx` — **modificar**: quitar `/pipeline` de `ADMIN_ONLY_PATHS`.
- `src/components/layout/Sidebar.tsx` — **modificar**: agregar "Embudo de Ventas" a `agentNav`.
- `src/routes/more.tsx` — **modificar**: quitar `adminOnly` del ítem `/pipeline`.
- `src/routes/pipeline.tsx` — **modificar**: badge de próximo contacto + resaltado vencido + Popover de seguimiento + ocultar nombre de agente a no-admin.
- `e2e/leads-agent.spec.ts` — **modificar**: agregar bloque de tests del embudo (acceso + seguimiento).

---

## Task 1: Migración `next_contact_at` + regenerar tipos

**Files:**
- Create: `supabase/migrations/20260731120000_leads_next_contact.sql`
- Modify: `src/integrations/supabase/types.ts` (regenerado)

**Interfaces:**
- Produces: columna `public.leads.next_contact_at date` (nullable). En `types.ts`: `leads.Row.next_contact_at: string | null`, `leads.Insert.next_contact_at?: string | null`, `leads.Update.next_contact_at?: string | null`.

- [ ] **Step 1: Escribir la migración**

Crear `supabase/migrations/20260731120000_leads_next_contact.sql`:

```sql
-- Próximo contacto para seguimiento en el Embudo de Ventas.
-- Nullable, sin default. Las políticas RLS por fila de leads ya cubren esta columna.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS next_contact_at date;
```

- [ ] **Step 2: Aplicar la migración a producción**

Aplicar vía MCP `apply_migration` (name: `leads_next_contact`, query = contenido del archivo) al proyecto `hlqmfwqeildvbokawngt`.

Verificar con `execute_sql`:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name='leads' and column_name='next_contact_at';
```

Expected: una fila `next_contact_at | date | YES`.

- [ ] **Step 3: Verificar RLS con la nueva columna (simulación)**

Ejecutar vía `execute_sql` (impersonando al agente). Confirma que el agente puede fijar `next_contact_at` en un lead **propio** y NO en uno **ajeno**:

```sql
begin;
insert into public.leads (agent_id, name) values ('f0be43d1-90da-4626-b20f-593079eb616a','__ajeno__');
select set_config('request.jwt.claims','{"sub":"a78f2f12-ab1d-40c4-8b37-32b131ce4bfc","role":"authenticated"}',true);
set local role authenticated;
do $$
declare own_lead uuid;
begin
  select id into own_lead from public.leads where agent_id='a78f2f12-ab1d-40c4-8b37-32b131ce4bfc' limit 1;
  begin
    update public.leads set next_contact_at = current_date + 3, notes='seguimiento' where id=own_lead;
    perform set_config('t.own','SI',true);
  exception when others then perform set_config('t.own','NO',true);
  end;
  begin
    update public.leads set next_contact_at = current_date + 3 where agent_id='f0be43d1-90da-4626-b20f-593079eb616a';
    perform set_config('t.foreign','NO (permitido!)',true);
  exception when others then perform set_config('t.foreign','SI (rechazado)',true);
  end;
end $$;
select current_setting('t.own') as propio_ok, current_setting('t.foreign') as ajeno_bloqueado;
rollback;
```

Expected: `propio_ok = SI`, `ajeno_bloqueado = SI (rechazado)`.

- [ ] **Step 4: Regenerar los tipos de Supabase**

Regenerar `src/integrations/supabase/types.ts` vía MCP `generate_typescript_types` (proyecto `hlqmfwqeildvbokawngt`) y sobrescribir el archivo. Confirmar que el bloque `leads` incluye `next_contact_at: string | null` en `Row` y `next_contact_at?: string | null` en `Insert`/`Update`.

Verificar:

Run: `grep -c "next_contact_at" src/integrations/supabase/types.ts`
Expected: `3` (Row, Insert, Update).

- [ ] **Step 5: Typecheck**

Run: `bunx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260731120000_leads_next_contact.sql src/integrations/supabase/types.ts
git commit -m "feat(leads): columna next_contact_at para seguimiento del embudo"
```

---

## Task 2: Acceso de agente al embudo (ruta + navegación)

**Files:**
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/routes/more.tsx`
- Modify: `e2e/leads-agent.spec.ts`

**Interfaces:**
- Consumes: nada de Task 1.
- Produces: `/pipeline` accesible para agentes; ítem "Embudo de Ventas" en `agentNav` y en `/more` sin `adminOnly`.

- [ ] **Step 1: Quitar `/pipeline` del candado admin**

En `src/components/layout/AppShell.tsx`, reemplazar la constante:

```ts
const ADMIN_ONLY_PATHS = ["/", "/users", "/pipeline", "/whatsapp", "/analytics"];
```

por:

```ts
const ADMIN_ONLY_PATHS = ["/", "/users", "/whatsapp", "/analytics"];
```

Y actualizar el comentario de arriba para incluir `/pipeline` entre lo que ven los agentes (acotado por RLS).

- [ ] **Step 2: Agregar "Embudo de Ventas" al Sidebar del agente**

En `src/components/layout/Sidebar.tsx`, dentro de `agentNav`, insertar después de la línea de `"/appointments"` (Citas):

```ts
  { to: "/pipeline", label: "Embudo de Ventas", icon: KanbanSquare },
```

`KanbanSquare` ya está importado (lo usa `adminNav`). No agregar imports.

- [ ] **Step 3: Mostrar el embudo a agentes en `/more`**

En `src/routes/more.tsx`, en el ítem del pipeline, quitar `adminOnly: true`:

```ts
      { to: "/pipeline",     label: "Embudo de Ventas", description: "Tablero de etapas", icon: KanbanSquare },
```

- [ ] **Step 4: Escribir el test E2E de acceso (falla primero)**

En `e2e/leads-agent.spec.ts`, agregar al final del archivo un nuevo describe:

```ts
test.describe.serial("Embudo — acceso de agente", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");
  });

  test("accede a /pipeline (no 403) y ve las columnas del embudo", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Embudo de Ventas" })).toBeVisible();
    await expect(page.getByText("Nuevo Prospecto")).toBeVisible();
    await expect(page.getByText("Negociación")).toBeVisible();
  });
});
```

- [ ] **Step 5: Correr el test — verificar comportamiento**

Run: `E2E_AGENT_PASSWORD='Salgon2026!' bunx playwright test --project=chromium-agent -g "Embudo — acceso" --reporter=list`
Expected: PASS (accede y ve columnas). Si el título del AppShell no es un `heading` accesible, ajustar el selector a `page.getByText("Embudo de Ventas").first()` y volver a correr hasta PASS.

- [ ] **Step 6: Typecheck**

Run: `bunx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/AppShell.tsx src/components/layout/Sidebar.tsx src/routes/more.tsx e2e/leads-agent.spec.ts
git commit -m "feat(pipeline): dar acceso al embudo a los agentes (acotado por RLS)"
```

---

## Task 3: Seguimiento en la tarjeta (próximo contacto + nota)

**Files:**
- Modify: `src/routes/pipeline.tsx`
- Modify: `e2e/leads-agent.spec.ts`

**Interfaces:**
- Consumes: `next_contact_at` en `LeadRow`/`LeadUpdate` (Task 1); `/pipeline` accesible al agente (Task 2).
- Produces: `LeadCard` del embudo con badge de próximo contacto, resaltado de vencido, y Popover editor que persiste `{ next_contact_at, notes }`.

- [ ] **Step 1: Agregar imports y helpers de fecha en `pipeline.tsx`**

En la cabecera de imports de `src/routes/pipeline.tsx`, añadir:

```ts
import { GripVertical, Phone, CalendarClock } from "lucide-react";
import { useLeads, useUpdateLead, type LeadRow, type LeadStatus } from "@/data/leadsApi";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useHasRole } from "@/hooks/useAuth";
import { useState } from "react";
```

(Nota: `GripVertical`/`Phone` ya se importan de lucide; sólo se agrega `CalendarClock`. `useMemo`/`useState` ya vienen de `react` en el import existente — no duplicar `useState` si ya está; verificar el import actual de react y añadir sólo lo que falte.)

Justo antes de `function PipelinePage()`, agregar helpers puros:

```ts
// Fecha "YYYY-MM-DD" (date de Postgres) → Date local a medianoche
function parseDbDate(d: string | null): Date | null {
  if (!d) return null;
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return null;
  return new Date(y, m - 1, day);
}

function toDbDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function isOverdue(nextContactAt: string | null, status: LeadStatus): boolean {
  const d = parseDbDate(nextContactAt);
  if (!d || status === "Closed") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}
```

- [ ] **Step 2: Crear el subcomponente `FollowUpEditor`**

En `src/routes/pipeline.tsx`, agregar antes de `function LeadCard(...)`:

```tsx
function FollowUpEditor({ lead }: { lead: LeadRow }) {
  const update = useUpdateLead();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const selected = parseDbDate(lead.next_contact_at) ?? undefined;

  async function save(next: { next_contact_at?: string | null; notes?: string }) {
    try {
      await update.mutateAsync({ id: lead.id, patch: next });
      toast.success("Seguimiento guardado");
    } catch (err) {
      toast.error((err as { message?: string }).message ?? "No se pudo guardar");
    }
  }

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setNotes(lead.notes ?? ""); }}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          aria-label="Seguimiento"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <CalendarClock className="h-3.5 w-3.5" /> Seguimiento
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 space-y-3"
        align="start"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div>
          <div className="text-xs font-medium mb-1.5">Próximo contacto</div>
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(d) => { if (d) void save({ next_contact_at: toDbDate(d) }); }}
            className="rounded-md border"
          />
          {lead.next_contact_at && (
            <Button
              size="sm"
              variant="ghost"
              className="mt-1 h-7 px-2 text-[11px] text-destructive"
              onClick={() => void save({ next_contact_at: null })}
            >
              Limpiar fecha
            </Button>
          )}
        </div>
        <div>
          <div className="text-xs font-medium mb-1.5">Nota</div>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Observaciones de seguimiento…" />
        </div>
        <div className="flex justify-end">
          <Button size="sm" disabled={update.isPending} onClick={async () => { await save({ notes }); setOpen(false); }}>
            Guardar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

Asegurarse de que `toast` ya esté importado (lo está: `import { toast } from "sonner";`).

- [ ] **Step 3: Renderizar badge + editor + ocultar agente en `LeadCard`**

En `src/routes/pipeline.tsx`, dentro de `LeadCard`, agregar `const isAdmin = useHasRole("admin");` al inicio del componente. Reemplazar el bloque final de la tarjeta (desde `<div className="mt-2 flex items-center justify-between text-xs">` hasta el cierre del bloque del teléfono) por:

```tsx
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-primary">{fmtMoney(Number(lead.budget))}</span>
            {isAdmin && <span className="text-muted-foreground">{lead.agent?.full_name?.split(" ")[0] ?? ""}</span>}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Phone className="h-3 w-3" />{lead.phone}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            {lead.next_contact_at ? (
              <span className={cn(
                "text-[11px] px-2 py-0.5 rounded-md",
                isOverdue(lead.next_contact_at, lead.status)
                  ? "bg-destructive/10 text-destructive font-medium"
                  : "bg-muted text-muted-foreground",
              )}>
                Próx: {fmtShort(parseDbDate(lead.next_contact_at)!)}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground/60">Sin seguimiento</span>
            )}
            <FollowUpEditor lead={lead} />
          </div>
```

(El `cn` ya está importado en el archivo.)

- [ ] **Step 4: Typecheck + build**

Run: `bunx tsc --noEmit`
Expected: exit 0.

Run: `bun run build`
Expected: `✓ built` y exit 0.

- [ ] **Step 5: Escribir el test E2E de seguimiento**

En `e2e/leads-agent.spec.ts`, dentro del describe "Embudo — acceso de agente" (o en uno nuevo `test.describe.serial("Embudo — seguimiento")`), agregar:

```ts
  test("fija un próximo contacto desde la tarjeta y persiste", async ({ page }) => {
    await page.goto("/pipeline");
    await page.waitForLoadState("networkidle");

    // Abre el editor de seguimiento de la primera tarjeta
    const followBtn = page.getByRole("button", { name: "Seguimiento" }).first();
    await expect(followBtn).toBeVisible();
    await followBtn.click();

    // Elige un día futuro visible en el calendario (día 28 del mes en curso)
    const popover = page.getByRole("dialog");
    await popover.getByRole("gridcell", { name: "28", exact: true }).first().click();

    // Aparece el toast de guardado
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: /seguimiento guardado/i }).first()).toBeVisible({ timeout: 8_000 });

    // Recarga y verifica que el badge "Próx:" persiste
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/Próx:/i).first()).toBeVisible();
  });
```

- [ ] **Step 6: Correr el test E2E de seguimiento**

Run: `E2E_AGENT_PASSWORD='Salgon2026!' bunx playwright test --project=chromium-agent -g "Embudo" --reporter=list`
Expected: PASS todos los del embudo (acceso + seguimiento). Si el calendario no muestra el día 28 (mes con día ya pasado no importa: sólo persiste la fecha), ajustar el nombre de `gridcell` a un día presente en la grilla y re-correr hasta PASS.

- [ ] **Step 7: Limpiar el dato de prueba (opcional)**

Vía `execute_sql`, limpiar el seguimiento sembrado por el E2E en los leads del agente para no dejar ruido:

```sql
update public.leads set next_contact_at = null
where agent_id = 'a78f2f12-ab1d-40c4-8b37-32b131ce4bfc' and next_contact_at is not null;
```

(Opcional; el dato es benigno. Omitir si se prefiere conservar el seguimiento de prueba.)

- [ ] **Step 8: Commit**

```bash
git add src/routes/pipeline.tsx e2e/leads-agent.spec.ts
git commit -m "feat(pipeline): seguimiento en la tarjeta (próximo contacto + nota)"
```

---

## Task 4: Regresión admin + cierre

**Files:** ninguno (verificación).

- [ ] **Step 1: Correr la suite admin del embudo/leads (sin regresión)**

Run: `E2E_PASSWORD='Salgon%2026%' bunx playwright test --project=chromium leads.spec.ts --reporter=list`
Expected: 4/4 PASS (la sesión admin no cambia de comportamiento).

- [ ] **Step 2: Build final**

Run: `bun run build`
Expected: exit 0.

- [ ] **Step 3: Actualizar memoria del proyecto**

Actualizar/crear la memoria del feature (patrón de [[leads-agent-access]]) con estado, verificación y pendientes (merge/deploy). Actualizar `MEMORY.md`.

---

## Self-Review (completado por el autor del plan)

**Cobertura del spec:**
- Acceso ruta+nav → Task 2. ✅
- Cero RLS → Task 1 (migración sin políticas) + verificación Step 3. ✅
- Migración `next_contact_at` + regen types → Task 1. ✅
- Badge + resaltado vencido → Task 3 Step 3 (`isOverdue`). ✅
- Popover con Calendar + Textarea (reusa notes) → Task 3 Step 2. ✅
- `stopPropagation` para no arrastrar → Task 3 Step 2 (trigger y content). ✅
- Ocultar agente a no-admin → Task 3 Step 3. ✅
- Pruebas RLS + E2E + build → Tasks 1, 2, 3, 4. ✅

**Consistencia de tipos:** `next_contact_at: string | null` usado consistente en helpers, editor y badge. `useUpdateLead` patch `{ next_contact_at, notes }` coincide con `LeadUpdate`.

**Placeholders:** ninguno — todo el código está completo.
