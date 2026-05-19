import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Eye, EyeOff, Star, CalendarDays, Filter,
  MapPin, Users as UsersIcon, Ticket,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PropertyCoverInput } from "@/components/properties/PropertyCoverInput";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/data/propertiesApi";
import {
  useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent,
  EVENT_TYPES, type EventType, type EventRow,
} from "@/data/eventsApi";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/events/")({
  component: EventsPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Eventos" error={error} reset={reset} />,
});

function EventsPage() {
  const { roles } = useAuth();
  return roles.includes("admin") ? <AdminEvents /> : <AgentEvents />;
}

function useFilters(items: EventRow[]) {
  const [type, setType] = useState<"all" | EventType>("all");
  const [when, setWhen] = useState<"all" | "upcoming" | "past">("upcoming");
  const filtered = useMemo(() => {
    const now = Date.now();
    return items.filter((e) => {
      if (type !== "all" && e.type !== type) return false;
      if (when !== "all") {
        const t = e.starts_at ? new Date(e.starts_at).getTime() : new Date(e.created_at).getTime();
        if (when === "upcoming" && t < now - 86400_000) return false;
        if (when === "past" && t >= now) return false;
      }
      return true;
    });
  }, [items, type, when]);
  return { type, setType, when, setWhen, filtered };
}

function FiltersBar(p: {
  type: "all" | EventType; setType: (v: "all" | EventType) => void;
  when: "all" | "upcoming" | "past"; setWhen: (v: "all" | "upcoming" | "past") => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />
      <Select value={p.type} onValueChange={(v) => p.setType(v as "all" | EventType)}>
        <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los tipos</SelectItem>
          {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={p.when} onValueChange={(v) => p.setWhen(v as "all" | "upcoming" | "past")}>
        <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="upcoming">Próximos</SelectItem>
          <SelectItem value="past">Pasados</SelectItem>
          <SelectItem value="all">Todos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function fmt(d?: string | null) {
  if (!d) return "Fecha por confirmar";
  return new Date(d).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ────────── Agent feed ──────────
function AgentEvents() {
  const { data: items = [], isLoading } = useEvents({ onlyPublished: true });
  const { type, setType, when, setWhen, filtered } = useFilters(items);
  return (
    <AppShell title="Eventos" subtitle="Asistencia y logística interna">
      <PageCard>
        <FiltersBar type={type} setType={setType} when={when} setWhen={setWhen} />
      </PageCard>
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Cargando…</div>
      ) : filtered.length === 0 ? (
        <PageCard>
          <div className="py-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <CalendarDays className="h-8 w-8 opacity-50" />
            No hay eventos {when === "upcoming" ? "próximos" : ""}.
          </div>
        </PageCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e) => <EventCard key={e.id} e={e} />)}
        </div>
      )}
    </AppShell>
  );
}

function EventCard({ e }: { e: EventRow }) {
  const img = normalizeImageUrl(e.image_url ?? "");
  return (
    <Link
      to="/events/$id"
      params={{ id: e.id }}
      className={cn(
        "group rounded-2xl border bg-card overflow-hidden shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-elevated)] transition-shadow flex flex-col",
        e.highlighted ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
      )}
    >
      <div className="relative aspect-video bg-muted overflow-hidden">
        {img ? <img src={img} alt="" className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform" />
          : <div className="h-full w-full grid place-items-center text-muted-foreground"><CalendarDays className="h-8 w-8" /></div>}
        <div className="absolute top-2 left-2 flex gap-1.5">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">{e.type}</span>
          {e.highlighted && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/90 text-warning-foreground inline-flex items-center gap-1"><Star className="h-3 w-3" /> Destacado</span>}
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-semibold leading-snug line-clamp-2">{e.title}</h3>
        <div className="text-xs text-muted-foreground flex flex-col gap-1">
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {fmt(e.starts_at)}</span>
          {e.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {e.location}</span>}
          {e.capacity != null && <span className="inline-flex items-center gap-1"><UsersIcon className="h-3.5 w-3.5" /> Cupo: {e.capacity}</span>}
        </div>
      </div>
    </Link>
  );
}

// ────────── Admin manager ──────────
function AdminEvents() {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useEvents();
  const { type, setType, when, setWhen, filtered } = useFilters(items);
  const update = useUpdateEvent();
  const del = useDeleteEvent();
  const [confirmDel, setConfirmDel] = useState<EventRow | null>(null);

  async function togglePublish(e: EventRow) {
    try {
      await update.mutateAsync({ id: e.id, patch: { status: e.status === "Published" ? "Draft" : "Published" } });
      toast.success(e.status === "Published" ? "Movido a borrador" : "Publicado");
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <AppShell title="Eventos" subtitle="Gestión de eventos y asistencia">
      <PageCard
        title="Todos los eventos"
        description={isLoading ? "Cargando…" : `${items.length} eventos`}
        action={
          <Button className="gap-1.5" onClick={() => navigate({ to: "/events/new" })}>
            <Plus className="h-4 w-4" /> Nuevo evento
          </Button>
        }
      >
        <div className="mb-3"><FiltersBar type={type} setType={setType} when={when} setWhen={setWhen} /></div>

        {filtered.length === 0 && !isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No hay eventos con esos filtros.</div>
        ) : null}

        <ul className="divide-y divide-border">
          {filtered.map((e) => {
            const img = normalizeImageUrl(e.image_url ?? "");
            return (
              <li key={e.id} className="py-3 flex items-center gap-3">
                <div className="h-14 w-20 shrink-0 rounded-md bg-muted overflow-hidden grid place-items-center">
                  {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <CalendarDays className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to="/events/$id" params={{ id: e.id }} className="font-medium hover:underline truncate">{e.title}</Link>
                    {e.highlighted && <Star className="h-3.5 w-3.5 text-warning" />}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-medium">{e.type}</span>
                    <span>·</span>
                    <span>{fmt(e.starts_at)}</span>
                    <span>·</span>
                    <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-medium",
                      e.status === "Published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                      {e.status === "Published" ? "Publicado" : "Borrador"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => togglePublish(e)} title={e.status === "Published" ? "Despublicar" : "Publicar"}>
                    {e.status === "Published" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/events/$id/edit" params={{ id: e.id }}><Pencil className="h-4 w-4" /></Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDel(e)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </PageCard>



      <AlertDialog open={!!confirmDel} onOpenChange={(o) => { if (!o) setConfirmDel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también sus horarios e inscripciones. “{confirmDel?.title}”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDel) return;
                try {
                  await del.mutateAsync(confirmDel.id);
                  toast.success("Evento eliminado");
                  setConfirmDel(null);
                } catch (e) { toast.error((e as Error).message); }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

// ────────── Form dialog ──────────
const schema = z.object({
  title: z.string().min(3, "Título muy corto").max(200),
  description: z.string().max(8000).default(""),
  type: z.enum(["Open House", "PASS Anual", "Capacitación", "Reunión Comercial"]),
  status: z.enum(["Published", "Draft"]),
  image_url: z.string().nullable(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  location: z.string().max(300).default(""),
  capacity: z.number().int().min(0).nullable(),
  related_property_id: z.string().nullable(),
  highlighted: z.boolean(),
});
type FormState = z.infer<typeof schema>;

function toLocalInput(d: string | null) {
  if (!d) return "";
  const dt = new Date(d);
  const off = dt.getTimezoneOffset();
  const local = new Date(dt.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}
function fromLocalInput(v: string) {
  return v ? new Date(v).toISOString() : null;
}

function EventFormDialog({
  open, onOpenChange, initial,
}: { open: boolean; onOpenChange: (v: boolean) => void; initial?: EventRow }) {
  const isEdit = !!initial;
  const { user } = useAuth();
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const { data: properties = [] } = useProperties();

  const [form, setForm] = useState<FormState>({
    title: "", description: "", type: "Open House", status: "Draft",
    image_url: null, starts_at: null, ends_at: null, location: "",
    capacity: null, related_property_id: null, highlighted: false,
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        title: initial.title, description: initial.description ?? "",
        type: initial.type, status: initial.status,
        image_url: initial.image_url, starts_at: initial.starts_at, ends_at: initial.ends_at,
        location: initial.location ?? "", capacity: initial.capacity,
        related_property_id: initial.related_property_id, highlighted: initial.highlighted,
      });
    } else {
      setForm({
        title: "", description: "", type: "Open House", status: "Draft",
        image_url: null, starts_at: null, ends_at: null, location: "",
        capacity: null, related_property_id: null, highlighted: false,
      });
    }
  }, [open, initial?.id]);

  function up<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    const d = parsed.data;
    const payload = {
      title: d.title, description: d.description, type: d.type, status: d.status,
      image_url: d.image_url || null,
      starts_at: d.starts_at || null, ends_at: d.ends_at || null,
      location: d.location, capacity: d.capacity,
      related_property_id: d.related_property_id || null,
      highlighted: d.highlighted,
    };
    try {
      if (isEdit && initial) {
        await update.mutateAsync({ id: initial.id, patch: payload });
        toast.success("Evento actualizado");
      } else {
        await create.mutateAsync({ ...payload, author_id: user?.id ?? null });
        toast.success("Evento creado");
      }
      onOpenChange(false);
    } catch (err) { toast.error((err as Error).message); }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Editar evento" : "Nuevo evento"}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => up("title", e.target.value)} maxLength={200} placeholder="Ej. Open House Modelo Jazmín — Sábado 11am" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={form.type} onValueChange={(v) => up("type", v as EventType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => up("status", v as "Published" | "Draft")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Borrador</SelectItem>
                  <SelectItem value="Published">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Inicio</Label>
              <Input type="datetime-local" value={toLocalInput(form.starts_at)} onChange={(e) => up("starts_at", fromLocalInput(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Fin</Label>
              <Input type="datetime-local" value={toLocalInput(form.ends_at)} onChange={(e) => up("ends_at", fromLocalInput(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ubicación</Label>
              <Input value={form.location} onChange={(e) => up("location", e.target.value)} placeholder="Casa club, sala B…" />
            </div>
            <div className="space-y-1.5">
              <Label>Cupo (opcional)</Label>
              <Input type="number" min={0} value={form.capacity ?? ""} onChange={(e) => up("capacity", e.target.value === "" ? null : Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Propiedad relacionada (opcional)</Label>
            <Select value={form.related_property_id ?? "none"} onValueChange={(v) => up("related_property_id", v === "none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Ninguna</SelectItem>
                {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.title} ({p.code})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Imagen de portada</Label>
            <PropertyCoverInput value={form.image_url ?? ""} onChange={(v) => up("image_url", v || null)} />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción / Agenda</Label>
            <Textarea rows={6} value={form.description} onChange={(e) => up("description", e.target.value)} placeholder="Detalles, agenda, materiales…" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.highlighted} onCheckedChange={(v) => up("highlighted", v)} />
            <Label>Destacar evento</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{isEdit ? "Guardar" : "Crear evento"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
