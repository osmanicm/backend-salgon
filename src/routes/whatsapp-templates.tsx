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

const templateSchema = z.object({
  name: z.string().trim().min(2, "Nombre demasiado corto").max(80),
  body: z.string().trim().min(2, "El mensaje es demasiado corto").max(2000),
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
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setName(initial?.name ?? "");
    setBody(initial?.body ?? "");
  }, [open, initial]);

  const pending = create.isPending || update.isPending;

  async function save() {
    setError(null);
    const parsed = templateSchema.safeParse({ name, body });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" · "));
      return;
    }
    try {
      if (isEdit && initial) {
        await update.mutateAsync({ id: initial.id, patch: parsed.data });
        toast.success("Plantilla actualizada");
      } else {
        await create.mutateAsync(parsed.data);
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
          <DialogDescription>
            Variables disponibles: {"{{name}}"}, {"{{property}}"}, {"{{date}}"}
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
            <Label>Nombre *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bienvenida"
              maxLength={80}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mensaje *</Label>
            <Textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hola {{name}}, …"
              required
            />
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
