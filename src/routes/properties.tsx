import { createFileRoute, useNavigate, useRouter, Outlet, useChildMatches } from "@tanstack/react-router";
import * as React from "react";
import { useState } from "react";
import { Plus, Search, Pencil, Trash2, Eye, MapPin, Upload, Share2, Loader2, FileSpreadsheet, RotateCcw, Archive } from "lucide-react";
import { BulkUploadDialog } from "@/components/properties/BulkUploadDialog";
import { PropertyMediaManager } from "@/components/properties/PropertyMediaManager";
import { PropertyCoverInput } from "@/components/properties/PropertyCoverInput";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fmtMoney, leads, type Lead } from "@/data/mock";
import {
  nextPropertyCode,
  useAgentsList,
  useCreateProperty,
  useDeletedProperties,
  useHardDeleteProperty,
  useProperties,
  useRestoreProperty,
  useSoftDeleteProperty,
  useUpdateProperty,
  type PropertyRow,
} from "@/data/propertiesApi";
import { setWhatsappHandoff, blobToDataUrl } from "@/data/whatsappHandoff";
import { useAuth, useHasRole } from "@/hooks/useAuth";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/properties")({
  component: PropertiesPage,
  errorComponent: PropertiesErrorBoundary,
});

function PropertiesErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <AppShell title="Propiedades" subtitle="Error">
      <PageCard
        title="No pudimos cargar esta sección"
        description="Ocurrió un error al renderizar la página de propiedades."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esto suele pasar tras una actualización si el navegador conserva una versión vieja del código.
            Intenta recargar; si persiste, vuelve al listado.
          </p>
          <pre className="text-xs bg-muted/50 border border-border rounded-md p-3 overflow-auto max-h-40">
            {error.message}
          </pre>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                router.invalidate();
                reset();
              }}
            >
              Reintentar
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Recargar página
            </Button>
          </div>
        </div>
      </PageCard>
    </AppShell>
  );
}

const propertySchema = z.object({
  title: z.string().trim().min(2, "Título demasiado corto").max(120),
  code: z.string().trim().min(2).max(20),
  price: z.number().min(0, "Precio inválido").max(999_999_999),
  location: z.string().trim().min(2).max(200),
  status: z.enum(["Available", "Reserved", "Sold"]),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  area: z.number().min(0).max(99_999),
  image_url: z.string().trim().url("URL inválida").max(500).or(z.literal("")),
  agent_id: z.string().uuid().nullable(),
  model: z.string().trim().max(80).optional().or(z.literal("")),
  lot: z.string().trim().max(40).optional().or(z.literal("")),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").or(z.literal("")),
});

function PropertiesPage() {
  const childMatches = useChildMatches();
  if (childMatches.length > 0) {
    return <Outlet />;
  }
  return <PropertiesIndex />;
}

function PropertiesIndex() {
  const propsQuery = useProperties();
  const properties = propsQuery.data ?? [];
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = useHasRole("admin");
  // Only admins can edit/delete. Agents only view & share.
  const canManage = React.useCallback(
    (_p: PropertyRow) => isAdmin,
    [isAdmin]
  );
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editing, setEditing] = useState<PropertyRow | null>(null);
  const [viewing, setViewing] = useState<PropertyRow | null>(null);
  const [deleting, setDeleting] = useState<PropertyRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const softDelete = useSoftDeleteProperty();

  const filtered = properties.filter((p) => {
    const matchesQ = (p.title + p.location + p.code).toLowerCase().includes(q.toLowerCase());
    const matchesS = status === "all" || p.status === status;
    return matchesQ && matchesS;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  React.useEffect(() => { setPage(1); }, [q, status, pageSize]);
  React.useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageStart = (page - 1) * pageSize;
  const paged = filtered.slice(pageStart, pageStart + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(filtered.length, pageStart + pageSize);

  async function shareOnWhatsapp(p: PropertyRow, lead?: Lead) {
    const greeting = lead ? `¡Hola ${lead.name.split(" ")[0]}!` : `¡Hola!`;
    const message =
      `${greeting} Te comparto esta propiedad que podría interesarte:\n\n` +
      `🏠 *${p.title}*\n` +
      `📍 ${p.location}\n` +
      `💰 ${fmtMoney(Number(p.price))}\n` +
      `🛏️ ${p.bedrooms} recámaras · 🛁 ${p.bathrooms} baños · 📐 ${p.area} m²\n\n` +
      `Folio: ${p.code}\n` +
      `¿Te gustaría agendar una visita?`;

    let image:
      | { filename: string; dataUrl: string; sizeBytes: number; mimeType: string }
      | undefined;
    if (p.image_url) {
      try {
        const res = await fetch(p.image_url);
        if (res.ok) {
          const blob = await res.blob();
          const mimeType = blob.type || "image/jpeg";
          const ext = mimeType.split("/")[1]?.split("+")[0] || "jpg";
          const dataUrl = await blobToDataUrl(blob);
          image = { filename: `${p.code}.${ext}`, dataUrl, sizeBytes: blob.size, mimeType };
        }
      } catch (e) {
        console.error("No se pudo adjuntar la imagen", e);
      }
    }

    setWhatsappHandoff({ message, toLeadId: lead?.id, image, meta: { propertyId: p.id } });
    navigate({ to: "/whatsapp" });
  }

  async function confirmDelete() {
    if (!deleting) return;
    if (!canManage(deleting)) {
      toast.error("No tienes permisos para eliminar esta propiedad");
      setDeleting(null);
      return;
    }
    try {
      await softDelete.mutateAsync(deleting.id);
      toast.success(`"${deleting.title}" enviada a la papelera`);
      setDeleting(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  return (
    <AppShell title="Propiedades" subtitle="Administra tu catálogo de propiedades">
      <PageCard
        title="Todas las Propiedades"
        description={
          propsQuery.isLoading
            ? "Cargando…"
            : `${filtered.length} de ${properties.length} listados`
        }
        action={
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="pl-9 w-full md:w-56" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estatus</SelectItem>
                <SelectItem value="Available">Disponible</SelectItem>
                <SelectItem value="Reserved">Apartado</SelectItem>
                <SelectItem value="Sold">Vendido</SelectItem>
              </SelectContent>
            </Select>
            {isAdmin && (
              <>
                <div className="hidden md:flex gap-2">
                  <Button variant="outline" className="gap-1.5" onClick={() => setTrashOpen(true)} title="Ver propiedades eliminadas">
                    <Archive className="h-4 w-4" /> Papelera
                  </Button>
                  <Button variant="outline" className="gap-1.5" onClick={() => setBulkOpen(true)}>
                    <FileSpreadsheet className="h-4 w-4" /> Importar CSV
                  </Button>
                  <Button className="gap-1.5" onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" /> Agregar Propiedad
                  </Button>
                </div>
                <div className="md:hidden flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTrashOpen(true)}>
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBulkOpen(true)}>
                    <Upload className="h-3.5 w-3.5" /> CSV
                  </Button>
                </div>
              </>
            )}
          </div>
        }
      >
        {propsQuery.isLoading && (
          <div className="py-16 grid place-items-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {propsQuery.isError && (
          <div className="py-12 text-center text-sm text-destructive">
            Error al cargar: {(propsQuery.error as Error).message}
          </div>
        )}

        {!propsQuery.isLoading && (
          <>
            {/* Mobile: card list */}
            <ul className="md:hidden space-y-3">
              {paged.map((p) => (
                <li key={p.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)]">
                  <div className="relative">
                    {p.image_url ? (
                      <img src={normalizeImageUrl(p.image_url)} alt={p.title} className="h-40 w-full object-cover" />
                    ) : (
                      <div className="h-40 w-full bg-muted grid place-items-center text-xs text-muted-foreground">Sin imagen</div>
                    )}
                    <div className="absolute top-2 left-2"><StatusBadge status={p.status} /></div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm tracking-tight truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" />{p.location}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-base font-semibold text-primary tabular-nums">{fmtMoney(Number(p.price))}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{p.code}</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-2">
                      {p.bedrooms} rec · {p.bathrooms} baños · {p.area} m² · {p.agent?.full_name ?? "Sin agente"}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => navigate({ to: "/properties/$id", params: { id: p.id } })}>
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </Button>
                      {canManage(p) && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(p)} aria-label="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <LeadPickerPopover
                        onPick={(lead) => shareOnWhatsapp(p, lead)}
                        trigger={
                          <Button size="sm" className="gap-1.5 bg-success text-success-foreground hover:bg-success/90" aria-label="WhatsApp">
                            <Share2 className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                      {canManage(p) && (
                        <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive shrink-0" aria-label="Eliminar" onClick={() => setDeleting(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="text-center text-sm text-muted-foreground py-12">No se encontraron propiedades.</li>
              )}
            </ul>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <th className="px-5 py-3 font-medium">Propiedad</th>
                    <th className="px-3 py-3 font-medium">Folio</th>
                    <th className="px-3 py-3 font-medium">Precio</th>
                    <th className="px-3 py-3 font-medium">Ubicación</th>
                    <th className="px-3 py-3 font-medium">Estatus</th>
                    <th className="px-3 py-3 font-medium">Agente</th>
                    <th className="px-5 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((p) => (
                    <tr key={p.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <img src={normalizeImageUrl(p.image_url)} alt={p.title} className="h-11 w-14 rounded-md object-cover" />
                          ) : (
                            <div className="h-11 w-14 rounded-md bg-muted grid place-items-center text-[10px] text-muted-foreground">—</div>
                          )}
                          <div>
                            <div className="font-medium">{p.title}</div>
                            <div className="text-xs text-muted-foreground">{p.bedrooms} rec · {p.bathrooms} baños · {p.area} m²</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{p.code}</td>
                      <td className="px-3 py-3 font-medium">{fmtMoney(Number(p.price))}</td>
                      <td className="px-3 py-3"><span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{p.location}</span></td>
                      <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-3 py-3">{p.agent?.full_name ?? <span className="text-xs text-muted-foreground italic">Sin asignar</span>}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ver" onClick={() => navigate({ to: "/properties/$id", params: { id: p.id } })}><Eye className="h-4 w-4" /></Button>
                          {canManage(p) && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                          )}
                          <LeadPickerPopover
                            onPick={(lead) => shareOnWhatsapp(p, lead)}
                            trigger={
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-success" aria-label="WhatsApp" title="Compartir por WhatsApp">
                                <Share2 className="h-4 w-4" />
                              </Button>
                            }
                          />
                          {canManage(p) && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Eliminar" onClick={() => setDeleting(p)}><Trash2 className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-sm text-muted-foreground py-12">No se encontraron propiedades.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
                <div className="text-muted-foreground">
                  Mostrando <span className="font-medium text-foreground">{showingFrom}</span>–<span className="font-medium text-foreground">{showingTo}</span> de <span className="font-medium text-foreground">{filtered.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden sm:inline">Por página</span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>«</Button>
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
                  <span className="text-xs text-muted-foreground tabular-nums px-1">
                    {page} / {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</Button>
                </div>
              </div>
            )}
          </>
        )}
      </PageCard>

      {/* Mobile FAB */}
      <div className="md:hidden fixed right-4 z-30" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}>
        <Button size="icon" className="h-14 w-14 rounded-full shadow-[var(--shadow-elevated)] bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition" aria-label="Agregar propiedad" onClick={() => setCreating(true)}>
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Create dialog */}
      <PropertyFormDialog
        open={creating}
        onOpenChange={setCreating}
        existing={properties}
        canManageInitial={true}
      />

      {/* Bulk CSV import dialog */}
      <BulkUploadDialog open={bulkOpen} onOpenChange={setBulkOpen} existing={properties} />

      {/* Edit dialog */}
      <PropertyFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        existing={properties}
        initial={editing ?? undefined}
        canManageInitial={editing ? canManage(editing) : false}
      />

      {/* View dialog */}
      <ViewDialog property={viewing} onClose={() => setViewing(null)} />

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar a la papelera?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.title}" se ocultará del catálogo. Un admin puede restaurarla más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {softDelete.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Trash dialog */}
      <TrashDialog open={trashOpen} onOpenChange={setTrashOpen} isAdmin={isAdmin} currentUserId={user?.id ?? null} />
    </AppShell>
  );
}

export function PropertyFormDialog({
  open,
  onOpenChange,
  initial,
  existing,
  canManageInitial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: PropertyRow;
  existing: PropertyRow[];
  canManageInitial: boolean;
}) {
  const isEdit = !!initial;
  const locked = isEdit && !canManageInitial;
  const create = useCreateProperty();
  const update = useUpdateProperty();
  const agentsQuery = useAgentsList();

  const [form, setForm] = useState({
    title: "",
    code: "",
    price: "",
    location: "",
    status: "Available" as "Available" | "Reserved" | "Sold",
    bedrooms: "0",
    bathrooms: "0",
    area: "0",
    image_url: "",
    agent_id: "none",
    model: "",
    lot: "",
    delivery_date: "",
  });

  React.useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        title: initial.title,
        code: initial.code,
        price: String(initial.price ?? ""),
        location: initial.location,
        status: initial.status,
        bedrooms: String(initial.bedrooms ?? 0),
        bathrooms: String(initial.bathrooms ?? 0),
        area: String(initial.area ?? 0),
        image_url: initial.image_url ?? "",
        agent_id: initial.agent_id ?? "none",
        model: initial.model ?? "",
        lot: initial.lot ?? "",
        delivery_date: initial.delivery_date ?? "",
      });
    } else {
      setForm({
        title: "",
        code: nextPropertyCode(existing),
        price: "",
        location: "",
        status: "Available",
        bedrooms: "0",
        bathrooms: "0",
        area: "0",
        image_url: "",
        agent_id: "none",
        model: "",
        lot: "",
        delivery_date: "",
      });
    }
  }, [open, initial, existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) {
      toast.error("No tienes permisos para editar esta propiedad");
      return;
    }
    const parsed = propertySchema.safeParse({
      title: form.title,
      code: form.code,
      price: Number(form.price),
      location: form.location,
      status: form.status,
      bedrooms: Number(form.bedrooms),
      bathrooms: Number(form.bathrooms),
      area: Number(form.area),
      image_url: form.image_url,
      agent_id: form.agent_id === "none" ? null : form.agent_id,
      model: form.model,
      lot: form.lot,
      delivery_date: form.delivery_date,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    const payload = {
      ...parsed.data,
      image_url: parsed.data.image_url || null,
      model: parsed.data.model || null,
      lot: parsed.data.lot || null,
      delivery_date: parsed.data.delivery_date || null,
    };
    try {
      if (isEdit && initial) {
        await update.mutateAsync({ id: initial.id, patch: payload });
        toast.success("Propiedad actualizada");
      } else {
        await create.mutateAsync(payload);
        toast.success("Propiedad creada");
      }
      onOpenChange(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar propiedad" : "Agregar nueva propiedad"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Modifica los datos y guarda los cambios." : "Completa los campos para registrar una nueva propiedad."}
          </DialogDescription>
        </DialogHeader>
        {locked && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Solo el agente asignado o un admin pueden editar esta propiedad.
          </div>
        )}
        <form onSubmit={handleSubmit} className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${locked ? "opacity-60 pointer-events-none" : ""}`}>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Penthouse Vista al Mar" required maxLength={120} />
            <p className="text-xs text-muted-foreground">Máx. 120 caracteres</p>
          </div>
          <div className="space-y-1.5">
            <Label>Folio</Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="P-1024" required maxLength={20} disabled={isEdit} />
            <p className="text-xs text-muted-foreground">{isEdit ? "El folio no se puede cambiar" : "Identificador único, máx. 20 caracteres"}</p>
          </div>
          <div className="space-y-1.5">
            <Label>Estatus</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "Available" | "Reserved" | "Sold" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Available">Disponible</SelectItem>
                <SelectItem value="Reserved">Apartado</SelectItem>
                <SelectItem value="Sold">Vendido</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Disponibilidad actual</p>
          </div>
          <div className="space-y-1.5">
            <Label>Precio (MXN) *</Label>
            <Input type="number" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="3500000" required />
            <p className="text-xs text-muted-foreground">Monto en pesos, sin comas</p>
          </div>
          <div className="space-y-1.5">
            <Label>Área (m²)</Label>
            <Input type="number" min="0" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            <p className="text-xs text-muted-foreground">Superficie en metros cuadrados</p>
          </div>
          <div className="space-y-1.5">
            <Label>Recámaras</Label>
            <Input type="number" min="0" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} />
            <p className="text-xs text-muted-foreground">Número entero ≥ 0</p>
          </div>
          <div className="space-y-1.5">
            <Label>Baños</Label>
            <Input type="number" min="0" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} />
            <p className="text-xs text-muted-foreground">Número entero ≥ 0</p>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Ubicación *</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="CDMX, Polanco" required maxLength={200} />
            <p className="text-xs text-muted-foreground">Ciudad y zona, máx. 200 caracteres</p>
          </div>
          <div className="space-y-1.5">
            <Label>Modelo</Label>
            <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Modelo A, Tipo Premium…" maxLength={80} />
            <p className="text-xs text-muted-foreground">Nombre/tipo del modelo</p>
          </div>
          <div className="space-y-1.5">
            <Label># Lote</Label>
            <Input value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })} placeholder="L-12, Mz 3 Lt 7…" maxLength={40} />
            <p className="text-xs text-muted-foreground">Identificador del lote</p>
          </div>
          <div className="space-y-1.5">
            <Label>Fecha de entrega</Label>
            <Input type="date" value={form.delivery_date} onChange={(e) => setForm({ ...form, delivery_date: e.target.value })} />
            <p className="text-xs text-muted-foreground">Opcional. Déjalo vacío si está por definir</p>
          </div>
          <div className="space-y-1.5">
            <Label>Agente Asignado</Label>
            <Select value={form.agent_id} onValueChange={(v) => setForm({ ...form, agent_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecciona un agente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin asignar</SelectItem>
                {(agentsQuery.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.full_name || a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Solo el agente asignado o un admin podrán editarla</p>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label>Imagen de portada</Label>
            <PropertyCoverInput
              value={form.image_url}
              onChange={(url) => setForm({ ...form, image_url: url })}
              propertyId={initial?.id}
            />
          </div>

          {isEdit && initial && !locked && (
            <div className="sm:col-span-2 border-t border-border pt-4 space-y-2">
              <div>
                <Label className="text-base">Galería y archivos descargables</Label>
                <p className="text-xs text-muted-foreground">
                  Sube la ficha PDF, fotos, renders y videos. Los agentes podrán descargarlos desde la vista de la propiedad.
                </p>
              </div>
              <PropertyMediaManager propertyId={initial.id} />
            </div>
          )}

          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancelar</Button>
            <Button type="submit" disabled={pending || locked}>
              {pending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {isEdit ? "Guardar cambios" : "Crear propiedad"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewDialog({ property, onClose }: { property: PropertyRow | null; onClose: () => void }) {
  return (
    <Dialog open={!!property} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        {property && (
          <>
            <DialogHeader>
              <DialogTitle>{property.title}</DialogTitle>
              <DialogDescription>Folio {property.code}</DialogDescription>
            </DialogHeader>
            {property.image_url && (
              <img src={normalizeImageUrl(property.image_url)} alt={property.title} className="w-full h-56 object-cover rounded-lg" />
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Precio">{fmtMoney(Number(property.price))}</Field>
              <Field label="Estatus"><StatusBadge status={property.status} /></Field>
              <Field label="Ubicación">{property.location}</Field>
              <Field label="Agente">{property.agent?.full_name ?? "Sin asignar"}</Field>
              <Field label="Recámaras">{property.bedrooms}</Field>
              <Field label="Baños">{property.bathrooms}</Field>
              <Field label="Área">{property.area} m²</Field>
              <Field label="Creada">{new Date(property.created_at).toLocaleDateString("es-MX")}</Field>
            </div>
            <DialogFooter><Button onClick={onClose}>Cerrar</Button></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  );
}

function LeadPickerPopover({ trigger, onPick }: { trigger: React.ReactNode; onPick: (lead?: Lead) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = leads.filter((l) => (l.name + " " + l.phone).toLowerCase().includes(q.toLowerCase()));

  function handlePick(lead?: Lead) {
    setOpen(false);
    setQ("");
    onPick(lead);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="p-3 border-b border-border">
          <div className="text-sm font-medium">Elige destinatario</div>
          <div className="text-xs text-muted-foreground mt-0.5">Selecciona un prospecto o continúa sin asignar.</div>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar prospecto…" className="h-8 pl-8 text-xs" />
          </div>
        </div>
        <ul className="max-h-60 overflow-y-auto py-1">
          {filtered.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => handlePick(l)} className="w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors">
                <div className="text-sm font-medium truncate">{l.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{l.phone}</div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="px-3 py-4 text-center text-xs text-muted-foreground">Sin resultados</li>}
        </ul>
        <div className="p-2 border-t border-border">
          <Button variant="outline" size="sm" className="w-full" onClick={() => handlePick(undefined)}>Continuar sin destinatario</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TrashDialog({
  open,
  onOpenChange,
  isAdmin,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  isAdmin: boolean;
  currentUserId: string | null;
}) {
  const trashQuery = useDeletedProperties();
  const restore = useRestoreProperty();
  const hardDelete = useHardDeleteProperty();
  const [confirmHard, setConfirmHard] = useState<PropertyRow | null>(null);

  const items = trashQuery.data ?? [];

  const canRestore = (p: PropertyRow) =>
    isAdmin || (!!currentUserId && p.agent_id === currentUserId);

  async function handleRestore(p: PropertyRow) {
    try {
      await restore.mutateAsync(p.id);
      toast.success(`"${p.title}" restaurada`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo restaurar");
    }
  }

  async function handleHardDelete() {
    if (!confirmHard) return;
    try {
      await hardDelete.mutateAsync(confirmHard.id);
      toast.success(`"${confirmHard.title}" eliminada permanentemente`);
      setConfirmHard(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5" /> Papelera de propiedades
            </DialogTitle>
            <DialogDescription>
              Propiedades eliminadas. Restáuralas o elimínalas permanentemente.
              {!isAdmin && " La eliminación permanente está reservada a administradores."}
            </DialogDescription>
          </DialogHeader>

          {trashQuery.isLoading && (
            <div className="py-12 grid place-items-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          )}

          {!trashQuery.isLoading && items.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              La papelera está vacía.
            </div>
          )}

          {!trashQuery.isLoading && items.length > 0 && (
            <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border -mx-2">
              {items.map((p) => (
                <li key={p.id} className="px-2 py-3 flex items-center gap-3">
                  {p.image_url ? (
                    <img src={normalizeImageUrl(p.image_url)} alt={p.title} className="h-12 w-16 rounded-md object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-16 rounded-md bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.code} · {p.location}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Eliminada {p.deleted_at ? new Date(p.deleted_at).toLocaleString() : "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={!canRestore(p) || restore.isPending}
                      onClick={() => handleRestore(p)}
                      title={!canRestore(p) ? "Solo el agente asignado o un admin puede restaurar" : undefined}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      disabled={!isAdmin}
                      onClick={() => setConfirmHard(p)}
                      title={!isAdmin ? "Solo administradores" : "Eliminar permanentemente"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmHard} onOpenChange={(o) => !o && setConfirmHard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará "{confirmHard?.title}" y sus archivos asociados de forma definitiva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleHardDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {hardDelete.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Eliminar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
