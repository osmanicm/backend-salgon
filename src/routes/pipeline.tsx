import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors, useDraggable } from "@dnd-kit/core";
import { GripVertical, Phone, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useLeads, useUpdateLead, type LeadRow, type LeadStatus, type LeadUpdate } from "@/data/leadsApi";
import { fmtMoney } from "@/data/mock";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useHasRole } from "@/hooks/useAuth";

import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/pipeline")({
  component: PipelinePage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Pipeline" error={error} reset={reset} />,
});

const columns: { id: LeadStatus; label: string; tint: string }[] = [
  { id: "New", label: "Nuevo Prospecto", tint: "border-t-info" },
  { id: "Contacted", label: "Contactado", tint: "border-t-muted-foreground" },
  { id: "Visit", label: "Visita Agendada", tint: "border-t-warning" },
  { id: "Negotiation", label: "Negociación", tint: "border-t-gold" },
  { id: "Closed", label: "Cerrado", tint: "border-t-success" },
];

function PipelinePage() {
  const { data: leads = [] } = useLeads();
  const update = useUpdateLead();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const grouped = useMemo(() => {
    const g: Record<LeadStatus, LeadRow[]> = { New: [], Contacted: [], Visit: [], Negotiation: [], Closed: [] };
    leads.forEach(l => g[l.status].push(l));
    return g;
  }, [leads]);

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id as LeadStatus | undefined;
    const id = e.active.id as string;
    if (!overId) return;
    const lead = leads.find(l => l.id === id);
    if (!lead || lead.status === overId) return;
    update.mutate(
      { id, patch: { status: overId } },
      { onError: (err) => toast.error((err as { message?: string }).message ?? "No se pudo mover") }
    );
  }

  const active = leads.find(i => i.id === activeId);

  return (
    <AppShell title="Embudo de Ventas" subtitle="Arrastra los prospectos entre etapas para actualizar su estatus">
      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        <div className="md:hidden -mx-4 px-4 overflow-x-auto snap-x snap-mandatory pb-2">
          <div className="flex gap-3" style={{ width: "max-content" }}>
            {columns.map(col => (
              <div key={col.id} className="snap-start w-[80vw] max-w-[320px] shrink-0">
                <Column id={col.id} label={col.label} tint={col.tint} count={grouped[col.id].length}>
                  {grouped[col.id].map(l => <LeadCard key={l.id} lead={l} />)}
                </Column>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-5 gap-4">
          {columns.map(col => (
            <Column key={col.id} id={col.id} label={col.label} tint={col.tint} count={grouped[col.id].length}>
              {grouped[col.id].map(l => <LeadCard key={l.id} lead={l} />)}
            </Column>
          ))}
        </div>
        <DragOverlay>{active ? <LeadCard lead={active} dragging /> : null}</DragOverlay>
      </DndContext>
    </AppShell>
  );
}

function Column({ id, label, tint, count, children }: { id: LeadStatus; label: string; tint: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={cn("rounded-2xl border border-border bg-card border-t-4 flex flex-col min-h-[40vh] md:min-h-[60vh] h-full", tint, isOver && "ring-2 ring-primary/30")}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="text-sm font-semibold">{label}</div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{count}</span>
      </div>
      <div className="p-3 space-y-2 flex-1">{children}</div>
    </div>
  );
}

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

function FollowUpEditor({ lead }: { lead: LeadRow }) {
  const update = useUpdateLead();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const selected = parseDbDate(lead.next_contact_at) ?? undefined;

  async function save(next: Pick<LeadUpdate, "next_contact_at" | "notes">) {
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
          className="h-7 px-2 gap-1 shrink-0 whitespace-nowrap text-[11px] text-muted-foreground hover:text-foreground"
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

function LeadCard({ lead, dragging }: { lead: LeadRow; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const isAdmin = useHasRole("admin");
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn("rounded-lg border border-border bg-background p-3 shadow-[var(--shadow-soft)] cursor-grab active:cursor-grabbing", (isDragging || dragging) && "opacity-90 shadow-[var(--shadow-elevated)]")}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{lead.name}</div>
          <div className="text-xs text-muted-foreground truncate">{lead.interest}</div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-primary">{fmtMoney(Number(lead.budget))}</span>
            {isAdmin && <span className="text-muted-foreground">{lead.agent?.full_name?.split(" ")[0] ?? ""}</span>}
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Phone className="h-3 w-3" />{lead.phone}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 min-w-0">
            {lead.next_contact_at ? (
              <span className={cn(
                "text-[11px] px-2 py-0.5 rounded-md truncate min-w-0",
                isOverdue(lead.next_contact_at, lead.status)
                  ? "bg-destructive/10 text-destructive font-medium"
                  : "bg-muted text-muted-foreground",
              )}>
                Próx: {fmtShort(parseDbDate(lead.next_contact_at)!)}
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground/60 truncate min-w-0">Sin seguimiento</span>
            )}
            <FollowUpEditor lead={lead} />
          </div>
        </div>
      </div>
    </div>
  );
}
