import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, CalendarClock, Users as UsersIcon, Save, Loader2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PropertyCoverInput } from "@/components/properties/PropertyCoverInput";
import { useAuth } from "@/hooks/useAuth";
import { useProperties } from "@/data/propertiesApi";
import {
  useEventItem, useCreateEvent, useUpdateEvent,
  useAddSlot, useDeleteSlot, useEventRegistrations,
  EVENT_TYPES, type EventType, type EventSlotRow,
} from "@/data/eventsApi";

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
  return new Date(dt.getTime() - off * 60000).toISOString().slice(0, 16);
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

const empty: FormState = {
  title: "", description: "", type: "Open House", status: "Published",
  image_url: null, starts_at: null, ends_at: null, location: "",
  capacity: null, related_property_id: null, highlighted: false,
};

export function EventEditor({ eventId }: { eventId?: string }) {
  const isEdit = !!eventId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: ev, isLoading } = useEventItem(eventId);
  const { data: properties = [] } = useProperties();
  const { data: registrations = [] } = useEventRegistrations(eventId);
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const addSlot = useAddSlot();
  const delSlot = useDeleteSlot();

  const [form, setForm] = useState<FormState>(empty);

  useEffect(() => {
    if (!isEdit) { setForm(empty); return; }
    if (!ev) return;
    setForm({
      title: ev.title, description: ev.description ?? "",
      type: ev.type, status: ev.status,
      image_url: ev.image_url, starts_at: ev.starts_at, ends_at: ev.ends_at,
      location: ev.location ?? "", capacity: ev.capacity,
      related_property_id: ev.related_property_id, highlighted: ev.highlighted,
    });
  }, [ev?.id, isEdit]);

  const up = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const slots = useMemo(
    () => (ev?.slots ?? []).slice().sort((a, b) =>
      new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [ev?.slots],
  );

  const regsBySlot = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of registrations) {
      if (r.slot_id && r.status !== "Cancelled") m.set(r.slot_id, (m.get(r.slot_id) ?? 0) + 1);
    }
    return m;
  }, [registrations]);

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
      if (isEdit && ev) {
        await update.mutateAsync({ id: ev.id, patch: payload });
        toast.success("Evento actualizado");
      } else {
        const created = await create.mutateAsync({ ...payload, author_id: user?.id ?? null });
        toast.success("Evento creado");
        navigate({ to: "/events/$id/edit", params: { id: created.id } });
      }
    } catch (err) { toast.error((err as Error).message); }
  }

  const pending = create.isPending || update.isPending;
  const isOpenHouse = form.type === "Open House";

  return (
    <AppShell
      title={isEdit ? "Editar evento" : "Nuevo evento"}
      subtitle={isOpenHouse ? "Open House con horarios y cupo por slot" : "Detalles del evento"}
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/events"><ArrowLeft className="h-4 w-4 mr-1.5" /> Eventos</Link>
        </Button>
        {isEdit && ev && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/events/$id" params={{ id: ev.id }}>Ver detalle</Link>
          </Button>
        )}
      </div>

      {isEdit && isLoading ? (
        <PageCard><div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div></PageCard>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <PageCard title="Información general">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Título *</Label>
                <Input value={form.title} onChange={(e) => up("title", e.target.value)} maxLength={200}
                  placeholder="Ej. Open House Modelo Jazmín — Sábado" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Inicio</Label>
                  <Input type="datetime-local" value={toLocalInput(form.starts_at)}
                    onChange={(e) => up("starts_at", fromLocalInput(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Fin</Label>
                  <Input type="datetime-local" value={toLocalInput(form.ends_at)}
                    onChange={(e) => up("ends_at", fromLocalInput(e.target.value))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ubicación</Label>
                  <Input value={form.location} onChange={(e) => up("location", e.target.value)}
                    placeholder="Casa club, sala B…" />
                </div>
                <div className="space-y-1.5">
                  <Label>Cupo general (opcional)</Label>
                  <Input type="number" min={0} value={form.capacity ?? ""}
                    onChange={(e) => up("capacity", e.target.value === "" ? null : Number(e.target.value))}
                    placeholder={isOpenHouse ? "Usa cupo por slot abajo" : ""} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Propiedad relacionada (opcional)</Label>
                <Select value={form.related_property_id ?? "none"}
                  onValueChange={(v) => up("related_property_id", v === "none" ? null : v)}>
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
                <Textarea rows={6} value={form.description} onChange={(e) => up("description", e.target.value)}
                  placeholder="Detalles, agenda, materiales…" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.highlighted} onCheckedChange={(v) => up("highlighted", v)} />
                <Label>Destacar evento</Label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 border-t pt-4">
              <Button type="button" variant="ghost" onClick={() => navigate({ to: "/events" })}>Cancelar</Button>
              <Button type="submit" disabled={pending} className="gap-1.5">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isEdit ? "Guardar cambios" : "Crear evento"}
              </Button>
            </div>
          </PageCard>

          {isOpenHouse && (
            <PageCard
              title="Horarios (slots)"
              description={isEdit
                ? "Define ventanas horarias con cupo individual para que los agentes se registren."
                : "Guarda el evento primero para administrar los horarios."}
            >
              {!isEdit ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Disponible después de crear el evento.
                </div>
              ) : (
                <SlotManager
                  eventId={ev!.id}
                  slots={slots}
                  registrationsBySlot={regsBySlot}
                  onAdd={(input) => addSlot.mutateAsync({ ...input, event_id: ev!.id })}
                  onDelete={(id) => delSlot.mutateAsync(id)}
                  adding={addSlot.isPending}
                  deleting={delSlot.isPending}
                />
              )}
            </PageCard>
          )}
        </form>
      )}
    </AppShell>
  );
}

function SlotManager(p: {
  eventId: string;
  slots: EventSlotRow[];
  registrationsBySlot: Map<string, number>;
  onAdd: (input: { starts_at: string; ends_at: string | null; capacity: number | null; label: string }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  adding: boolean;
  deleting: boolean;
}) {
  const [starts, setStarts] = useState("");
  const [ends, setEnds] = useState("");
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState<string>("");

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    if (!starts) { toast.error("Selecciona la hora de inicio"); return; }
    try {
      await p.onAdd({
        starts_at: new Date(starts).toISOString(),
        ends_at: ends ? new Date(ends).toISOString() : null,
        capacity: capacity === "" ? null : Number(capacity),
        label: label.trim(),
      });
      setStarts(""); setEnds(""); setLabel(""); setCapacity("");
      toast.success("Horario agregado");
    } catch (err) { toast.error((err as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Inicio *</Label>
            <Input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Fin</Label>
            <Input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Etiqueta (opcional)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Turno mañana" />
          </div>
          <div className="space-y-1.5">
            <Label>Cupo del horario</Label>
            <Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Sin límite" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={handleAdd} disabled={p.adding} className="gap-1.5">
            <Plus className="h-4 w-4" /> Agregar horario
          </Button>
        </div>
      </div>

      {p.slots.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
          <CalendarClock className="h-6 w-6 opacity-60" />
          Aún no hay horarios. Agrega el primero arriba.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border">
          {p.slots.map((s) => {
            const used = p.registrationsBySlot.get(s.id) ?? 0;
            const full = s.capacity != null && used >= s.capacity;
            return (
              <li key={s.id} className="p-3 flex items-center gap-3">
                <CalendarClock className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">
                    {new Date(s.starts_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                    {s.ends_at && <> — {new Date(s.ends_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</>}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                    {s.label && <span>{s.label}</span>}
                    <span className="inline-flex items-center gap-1">
                      <UsersIcon className="h-3.5 w-3.5" />
                      {used}{s.capacity != null ? ` / ${s.capacity}` : ""} inscritos
                    </span>
                    {full && <span className="px-1.5 py-0.5 rounded bg-destructive/15 text-destructive text-[10px] font-medium">Lleno</span>}
                  </div>
                </div>
                <Button type="button" size="sm" variant="ghost" disabled={p.deleting}
                  onClick={async () => {
                    if (!confirm("¿Eliminar este horario? Las inscripciones asociadas se borrarán.")) return;
                    try { await p.onDelete(s.id); toast.success("Horario eliminado"); }
                    catch (err) { toast.error((err as Error).message); }
                  }}
                  className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
