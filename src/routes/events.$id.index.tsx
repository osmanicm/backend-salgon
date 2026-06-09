import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarDays, MapPin, Users as UsersIcon, Star, CheckCircle2, X,
  Plus, Trash2, Ticket, Loader2,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  useEventItem, useEventRegistrations, useMyRegistration,
  useRegister, useCancelRegistration, useAddSlot, useDeleteSlot,
  type EventRow,
} from "@/data/eventsApi";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/events/$id/")({
  component: EventDetailPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Evento" error={error} reset={reset} />,
});

function fmt(d?: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-MX", opts ?? { dateStyle: "medium", timeStyle: "short" });
}

function EventDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const { data: ev, isLoading } = useEventItem(id);
  const { data: registrations = [] } = useEventRegistrations(isAdmin ? id : undefined);
  const { data: myReg } = useMyRegistration(id, user?.id);
  const register = useRegister();
  const cancel = useCancelRegistration();

  if (isLoading) return <AppShell title="Evento"><PageCard><div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div></PageCard></AppShell>;
  if (!ev) return <AppShell title="Evento"><PageCard><div className="py-10 text-center text-sm text-muted-foreground">Evento no encontrado.</div></PageCard></AppShell>;

  const img = normalizeImageUrl(ev.image_url ?? "");
  const slots = ev.slots ?? [];
  const confirmedCount = registrations.filter((r) => r.status !== "Cancelled").length;
  const isFull = ev.capacity != null && confirmedCount >= ev.capacity;

  async function handleRegister(slotId?: string) {
    if (!user) { toast.error("Inicia sesión"); return; }
    try {
      await register.mutateAsync({ event_id: ev!.id, slot_id: slotId ?? null, user_id: user.id });
      toast.success("¡Inscripción confirmada!");
    } catch (e) { toast.error((e as Error).message); }
  }
  async function handleCancel() {
    if (!myReg) return;
    try {
      await cancel.mutateAsync(myReg.id);
      toast.success("Inscripción cancelada");
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <AppShell title="Eventos">
      <PageCard>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/events" })} className="mb-3 -ml-2"><ArrowLeft className="h-4 w-4 mr-1" /> Volver</Button>
        {img && <div className="rounded-xl overflow-hidden mb-4 aspect-video bg-muted"><img src={img} alt="" className="h-full w-full object-cover" /></div>}
        <div className="flex flex-wrap items-start gap-2 mb-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground uppercase tracking-wider">{ev.type}</span>
          {ev.highlighted && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/90 text-warning-foreground inline-flex items-center gap-1"><Star className="h-3 w-3" /> Destacado</span>}
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
            ev.status === "Published" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{ev.status === "Published" ? "Publicado" : "Borrador"}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-3">{ev.title}</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-muted-foreground mb-4">
          <div className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4" /> {fmt(ev.starts_at)}</div>
          {ev.location && <div className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> {ev.location}</div>}
          {ev.capacity != null && <div className="inline-flex items-center gap-2"><UsersIcon className="h-4 w-4" /> Cupo: {ev.capacity}{isAdmin ? ` · ${confirmedCount} inscritos` : ""}</div>}
        </div>

        {ev.description && (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/90">{ev.description}</div>
        )}

        {ev.property && (
          <div className="mt-4 rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <div className="text-xs text-muted-foreground mb-1">Propiedad relacionada</div>
            <Link to="/properties/$id" params={{ id: ev.property.id }} search={{ q: "" }} className="font-medium hover:underline">{ev.property.title} ({ev.property.code})</Link>
          </div>
        )}
      </PageCard>

      {/* RSVP / Slot picker */}
      {ev.status === "Published" && (
        <PageCard title={ev.type === "Open House" ? "Horarios disponibles" : "Inscripción"}>
          {ev.type === "Open House" && slots.length > 0 ? (
            <ul className="space-y-2">
              {slots.sort((a, b) => a.starts_at.localeCompare(b.starts_at)).map((s) => {
                const mine = myReg?.slot_id === s.id;
                return (
                  <li key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{fmt(s.starts_at, { dateStyle: "medium", timeStyle: "short" })}{s.ends_at ? ` – ${fmt(s.ends_at, { timeStyle: "short" })}` : ""}</div>
                      {s.label && <div className="text-xs text-muted-foreground">{s.label}</div>}
                      {s.capacity != null && <div className="text-xs text-muted-foreground">Cupo: {s.capacity}</div>}
                    </div>
                    {mine ? (
                      <Button size="sm" variant="outline" onClick={handleCancel} disabled={cancel.isPending}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
                    ) : (
                      <Button size="sm" onClick={() => handleRegister(s.id)} disabled={!!myReg || register.isPending}>
                        {register.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Ticket className="h-4 w-4 mr-1" /> Reservar</>}
                      </Button>
                    )}
                  </li>
                );
              })}
              {myReg && <p className="text-xs text-muted-foreground">Ya tienes un horario reservado. Cancélalo para elegir otro.</p>}
            </ul>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm text-muted-foreground">
                {myReg ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" /> Tu asistencia está confirmada.</span>
                  : isFull ? "Cupo lleno." : "Confirma tu asistencia para reservar tu lugar."}
              </div>
              {myReg ? (
                <Button variant="outline" onClick={handleCancel} disabled={cancel.isPending}><X className="h-4 w-4 mr-1" /> Cancelar asistencia</Button>
              ) : (
                <Button onClick={() => handleRegister()} disabled={isFull || register.isPending}>
                  {register.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Ticket className="h-4 w-4 mr-1" /> Confirmar asistencia</>}
                </Button>
              )}
            </div>
          )}
        </PageCard>
      )}

      {/* Admin: slot management + attendance list */}
      {isAdmin && (
        <>
          {ev.type === "Open House" && <AdminSlotManager event={ev} />}
          <PageCard title={`Inscritos (${registrations.length})`}>
            {registrations.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Aún no hay inscripciones.</div>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {registrations.map((r) => (
                  <li key={r.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="text-sm truncate">{r.user?.full_name || r.user?.email || r.user_id}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{fmt(r.created_at)}</span>
                      <span className={cn("px-1.5 py-0.5 rounded-md text-[10px] font-medium",
                        r.status === "Confirmed" ? "bg-success/15 text-success" :
                        r.status === "Attended" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{r.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PageCard>
        </>
      )}
    </AppShell>
  );
}

function AdminSlotManager({ event }: { event: EventRow }) {
  const addSlot = useAddSlot();
  const delSlot = useDeleteSlot();
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [capacity, setCapacity] = useState<string>("");
  const [label, setLabel] = useState("");

  async function add() {
    if (!startsAt) { toast.error("Define la hora de inicio"); return; }
    try {
      await addSlot.mutateAsync({
        event_id: event.id,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        capacity: capacity === "" ? null : Number(capacity),
        label,
      });
      toast.success("Horario agregado");
      setStartsAt(""); setEndsAt(""); setCapacity(""); setLabel("");
    } catch (e) { toast.error((e as Error).message); }
  }

  const slots = (event.slots ?? []).slice().sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  return (
    <PageCard title="Horarios (Open House)" description="Cada horario tiene su propio cupo">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-3">
        <div className="space-y-1"><Label className="text-xs">Inicio</Label><Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Fin</Label><Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Cupo</Label><Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></div>
        <div className="space-y-1"><Label className="text-xs">Etiqueta</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Grupo A" /></div>
        <div className="flex items-end"><Button className="w-full" onClick={add} disabled={addSlot.isPending}><Plus className="h-4 w-4 mr-1" /> Agregar</Button></div>
      </div>
      {slots.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4 text-center">No hay horarios todavía.</div>
      ) : (
        <ul className="divide-y divide-border">
          {slots.map((s) => (
            <li key={s.id} className="py-2 flex items-center gap-2">
              <div className="flex-1 text-sm">
                <span className="font-medium">{fmt(s.starts_at)}{s.ends_at ? ` – ${fmt(s.ends_at, { timeStyle: "short" })}` : ""}</span>
                {s.label && <span className="text-muted-foreground"> · {s.label}</span>}
                {s.capacity != null && <span className="text-muted-foreground"> · cupo {s.capacity}</span>}
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => delSlot.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </PageCard>
  );
}
