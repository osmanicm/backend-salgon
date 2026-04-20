import { cn } from "@/lib/utils";

const map: Record<string, string> = {
  Available: "bg-success/10 text-success border-success/20",
  Reserved: "bg-warning/15 text-warning-foreground border-warning/30",
  Sold: "bg-muted text-muted-foreground border-border",
  New: "bg-info/10 text-info border-info/20",
  Contacted: "bg-accent text-accent-foreground border-border",
  Visit: "bg-warning/15 text-warning-foreground border-warning/30",
  Negotiation: "bg-gold/20 text-gold-foreground border-gold/30",
  Closed: "bg-success/10 text-success border-success/20",
  Admin: "bg-primary/10 text-primary border-primary/20",
  Agent: "bg-muted text-muted-foreground border-border",
};

const labelEs: Record<string, string> = {
  Available: "Disponible",
  Reserved: "Apartado",
  Sold: "Vendido",
  New: "Nuevo",
  Contacted: "Contactado",
  Visit: "Visita",
  Negotiation: "Negociación",
  Closed: "Cerrado",
  Admin: "Administrador",
  Agent: "Agente",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        map[status] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {labelEs[status] ?? status}
    </span>
  );
}
