import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors, useDraggable } from "@dnd-kit/core";
import { GripVertical, Phone } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { leads as initialLeads, agents, fmtMoney, type Lead, type LeadStatus } from "@/data/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pipeline")({ component: PipelinePage });

const columns: { id: LeadStatus; label: string; tint: string }[] = [
  { id: "New", label: "Nuevo Prospecto", tint: "border-t-info" },
  { id: "Contacted", label: "Contactado", tint: "border-t-muted-foreground" },
  { id: "Visit", label: "Visita Agendada", tint: "border-t-warning" },
  { id: "Negotiation", label: "Negociación", tint: "border-t-gold" },
  { id: "Closed", label: "Cerrado", tint: "border-t-success" },
];

function PipelinePage() {
  const [items, setItems] = useState<Lead[]>(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const grouped = useMemo(() => {
    const g: Record<LeadStatus, Lead[]> = { New: [], Contacted: [], Visit: [], Negotiation: [], Closed: [] };
    items.forEach(l => g[l.status].push(l));
    return g;
  }, [items]);

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id as LeadStatus | undefined;
    if (!overId) return;
    setItems(prev => prev.map(l => l.id === e.active.id ? { ...l, status: overId } : l));
  }

  const active = items.find(i => i.id === activeId);

  return (
    <AppShell title="Embudo de Ventas" subtitle="Arrastra los prospectos entre etapas para actualizar su estatus">
      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={onDragEnd}>
        {/* Horizontal scroll on mobile, grid on desktop */}
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
    <div ref={setNodeRef} className={cn("rounded-xl border border-border bg-card border-t-4 flex flex-col min-h-[60vh]", tint, isOver && "ring-2 ring-primary/30")}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="text-sm font-semibold">{label}</div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{count}</span>
      </div>
      <div className="p-3 space-y-2 flex-1">{children}</div>
    </div>
  );
}

function LeadCard({ lead, dragging }: { lead: Lead; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const agent = agents.find(a => a.id === lead.agentId);
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
            <span className="font-semibold text-primary">{fmtMoney(lead.budget)}</span>
            <span className="text-muted-foreground">{agent?.name.split(" ")[0]}</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Phone className="h-3 w-3" />{lead.phone}
          </div>
        </div>
      </div>
    </div>
  );
}
