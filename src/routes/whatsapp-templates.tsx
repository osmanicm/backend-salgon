import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { useState } from "react";
import { Plus, Pencil, Trash2, Loader2, MessageCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";
import {
  useWhatsappTemplates,
  useCreateWhatsappTemplate,
  useUpdateWhatsappTemplate,
  useDeleteWhatsappTemplate,
  type WhatsappTemplateRow,
} from "@/data/whatsappTemplatesApi";

export const Route = createFileRoute("/whatsapp-templates")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/agent" });
  },
  component: WhatsappTemplatesPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary title="Plantillas de WhatsApp" error={error} reset={reset} />
  ),
});

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

function WhatsappTemplatesPage() {
  const navigate = useNavigate();
  const templatesQuery = useWhatsappTemplates();
  const templates = templatesQuery.data ?? [];
  const del = useDeleteWhatsappTemplate();

  const [editing, setEditing] = useState<WhatsappTemplateRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<WhatsappTemplateRow | null>(null);

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await del.mutateAsync(deleting.id);
      toast.success(`Plantilla "${deleting.name}" eliminada`);
      setDeleting(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  return (
    <AppShell
      title="Plantillas de WhatsApp"
      subtitle="Mensajes pre-aprobados, compartidos por todo el equipo"
    >
      <PageCard
        title="Plantillas"
        description={templatesQuery.isLoading ? "Cargando…" : `${templates.length} plantilla(s)`}
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate({ to: "/settings" })}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Configuración
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> Nueva plantilla
            </Button>
          </div>
        }
      >
        {templatesQuery.isLoading && (
          <div className="py-16 grid place-items-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {templatesQuery.isError && (
          <div className="py-12 text-center text-sm text-destructive">
            Error al cargar: {(templatesQuery.error as Error).message}
          </div>
        )}
        {!templatesQuery.isLoading && !templatesQuery.isError && (
          <ul className="divide-y divide-border -mx-1">
            {templates.map((t) => (
              <li key={t.id} className="px-1 py-3 flex items-start gap-3">
                <span className="h-9 w-9 rounded-lg bg-success/10 text-success grid place-items-center shrink-0">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{t.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap">
                    {t.body}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label="Editar"
                    onClick={() => setEditing(t)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    aria-label="Eliminar"
                    onClick={() => setDeleting(t)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
            {templates.length === 0 && (
              <li className="text-center text-sm text-muted-foreground py-12">
                Aún no hay plantillas. Crea la primera con "Nueva plantilla".
              </li>
            )}
          </ul>
        )}
      </PageCard>

      <TemplateFormDialog open={creating} onOpenChange={setCreating} />
      <TemplateFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing ?? undefined}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.name}" dejará de estar disponible para el equipo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {del.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

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
    setHeaderFormat((initial?.header_format as "NONE" | "TEXT" | "IMAGE" | "DOCUMENT") ?? "NONE");
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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bienvenida"
              maxLength={80}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nombre de plantilla en Meta</Label>
              <Input
                value={metaName}
                onChange={(e) => setMetaName(e.target.value)}
                placeholder="hello_world"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Idioma (código Meta)</Label>
              <Input
                value={metaLang}
                onChange={(e) => setMetaLang(e.target.value)}
                placeholder="es_MX"
                maxLength={10}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Encabezado (header)</Label>
            <select
              value={headerFormat}
              onChange={(e) =>
                setHeaderFormat(e.target.value as "NONE" | "TEXT" | "IMAGE" | "DOCUMENT")
              }
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
              <p className="text-xs text-muted-foreground">
                Sin variables (plantilla de texto fijo).
              </p>
            )}
            <div className="space-y-2">
              {varMap.map((vm, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10 shrink-0">{`{{${i + 1}}}`}</span>
                  <select
                    value={vm.source}
                    onChange={(e) =>
                      setVarMap((arr) =>
                        arr.map((x, j) => (j === i ? { ...x, source: e.target.value } : x)),
                      )
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
                        setVarMap((arr) =>
                          arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                        )
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
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hola {{name}}, …"
              required
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
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
