import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import {
  FileText, Filter, RefreshCw, Smartphone, Database, CheckCircle2,
  Pencil, Save, X, Printer, Search, ChevronDown, ChevronRight, Send, CircleDollarSign, History, User as UserIcon,
} from "lucide-react";
import { setWhatsappHandoff, blobToDataUrl } from "@/data/whatsappHandoff";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  fmtMXN,
  agents,
  type AvailabilityRow, type AvailabilityStatus,
} from "@/data/mock";
import {
  useAvailability, updateAvailabilityRow, bulkUpdateAvailabilityStatus,
} from "@/data/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/availability")({
  component: AvailabilityPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Disponibilidad" error={error} reset={reset} />,
});

const STATUS_TINTS: Record<AvailabilityStatus, string> = {
  Available: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  Reserved:  "bg-amber-50  text-amber-800  ring-1 ring-amber-200",
  Sold:      "bg-rose-50   text-rose-700   ring-1 ring-rose-200",
};

const STATUS_DOT: Record<AvailabilityStatus, string> = {
  Available: "bg-emerald-500",
  Reserved:  "bg-amber-500",
  Sold:      "bg-rose-500",
};

function AvailabilityPage() {
  const rows = useAvailability();
  const [model, setModel] = useState<string>("all");
  const [cluster, setCluster] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<AvailabilityRow>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<AvailabilityStatus>("Available");
  const [pdfOpen, setPdfOpen] = useState(false);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const models   = useMemo(() => Array.from(new Set(rows.map(r => r.model))), [rows]);
  const clusters = useMemo(() => Array.from(new Set(rows.map(r => r.cluster))), [rows]);

  const filtered = useMemo(() => rows.filter(r =>
    (model === "all" || r.model === model) &&
    (cluster === "all" || r.cluster === cluster) &&
    (status === "all" || r.status === status) &&
    (q === "" || `${r.model} ${r.lot} ${r.cluster} ${r.notes}`.toLowerCase().includes(q.toLowerCase()))
  ), [rows, model, cluster, status, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, AvailabilityRow[]>();
    filtered.forEach(r => {
      if (!map.has(r.model)) map.set(r.model, []);
      map.get(r.model)!.push(r);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const counts = useMemo(() => ({
    total: rows.length,
    available: rows.filter(r => r.status === "Available").length,
    reserved:  rows.filter(r => r.status === "Reserved").length,
    sold:      rows.filter(r => r.status === "Sold").length,
  }), [rows]);

  function startEdit(r: AvailabilityRow) {
    setEditingId(r.id);
    setDraft({ price: r.price, delivery: r.delivery, status: r.status, notes: r.notes });
  }
  function cancelEdit() { setEditingId(null); setDraft({}); }
  function saveEdit(id: string) {
    const { syncedPropertyIds } = updateAvailabilityRow(id, {
      price: draft.price,
      delivery: draft.delivery,
      status: draft.status,
      notes: draft.notes,
    });
    cancelEdit();
    if (syncedPropertyIds.length > 0) {
      toast.success("Disponibilidad actualizada", {
        description: `Estatus sincronizado a la propiedad ${syncedPropertyIds.join(", ")} · enviado al API móvil`,
      });
    } else {
      toast.success("Disponibilidad actualizada", {
        description: "Sincronizado vía API REST · los clientes móviles se actualizarán",
      });
    }
  }

  function quickMarkSold(r: AvailabilityRow) {
    if (r.status === "Sold") return;
    const { syncedPropertyIds } = updateAvailabilityRow(r.id, { status: "Sold" });
    const propsNote = syncedPropertyIds.length > 0
      ? ` · propiedad ${syncedPropertyIds.join(", ")} sincronizada`
      : "";
    toast.success(`Lote ${r.lot} marcado como Vendido`, {
      description: `availability_master · UPDATE status='Sold'${propsNote}`,
    });
  }

  function toggleRow(id: string, on: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }
  function toggleAllVisible(on: boolean) {
    setSelected(prev => {
      const next = new Set(prev);
      filtered.forEach(r => { if (on) next.add(r.id); else next.delete(r.id); });
      return next;
    });
  }
  function applyBulk() {
    const { syncedPropertyIds } = bulkUpdateAvailabilityStatus(selected, bulkStatus);
    const statusEs = bulkStatus === "Available" ? "Disponible" : bulkStatus === "Reserved" ? "Apartado" : "Vendido";
    const propsNote = syncedPropertyIds.length > 0
      ? ` · ${syncedPropertyIds.length} propiedad${syncedPropertyIds.length === 1 ? "" : "es"} sincronizada${syncedPropertyIds.length === 1 ? "" : "s"} (${syncedPropertyIds.join(", ")})`
      : "";
    toast.success(`${selected.size} unidad(es) marcadas como ${statusEs}`, {
      description: `availability_master · UPDATE WHERE id IN (…) · sincronizado con /api/availability${propsNote}`,
    });
    setBulkOpen(false);
    setSelected(new Set());
  }

  return (
    <AppShell
      title="Disponibilidad General"
      subtitle="Fuente única de información sincronizada con todas las propiedades y la app móvil"
    >
      {/* Sync status banner */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inset-0 rounded-full bg-success/60 animate-ping" />
            <span className="relative h-2.5 w-2.5 rounded-full bg-success" />
          </span>
          <span className="text-sm font-medium">En vivo · sincronizado</span>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5" /> <code className="font-mono">availability_master</code> → <code className="font-mono">properties</code>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Smartphone className="h-3.5 w-3.5" /> App Flutter · último envío hace 2 min
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Stat label="Total"      value={counts.total} />
          <Stat label="Disponible" value={counts.available} tint="text-emerald-600" />
          <Stat label="Apartado"   value={counts.reserved}  tint="text-amber-600" />
          <Stat label="Vendido"    value={counts.sold}      tint="text-rose-600" />
        </div>
      </div>

      {/* Status legend */}
      <PageCard title="Leyenda de estatus" description="Cómo interpretar cada color en la matriz">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <LegendItem
            tint={STATUS_TINTS.Available}
            dot={STATUS_DOT.Available}
            label="Disponible"
            help="Unidad lista para venta. Visible para todos los agentes y la app móvil."
          />
          <LegendItem
            tint={STATUS_TINTS.Reserved}
            dot={STATUS_DOT.Reserved}
            label="Apartado"
            help="Cliente con anticipo o compromiso. Bloqueada por 7 días."
          />
          <LegendItem
            tint={STATUS_TINTS.Sold}
            dot={STATUS_DOT.Sold}
            label="Vendido"
            help="Operación cerrada. Se retira del inventario disponible."
          />
        </div>
      </PageCard>

      {/* Toolbar */}
      <PageCard
        title="Matriz de inventario"
        description={`${filtered.length} de ${rows.length} unidades · agrupadas por modelo · clic en ✏️ para editar`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5"
              disabled={selected.size === 0}
              onClick={() => setBulkOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5" />
              Actualizar en lote {selected.size > 0 && `(${selected.size})`}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setPdfOpen(true)}>
              <FileText className="h-3.5 w-3.5" /> Generar PDF de Disponibilidad
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="relative md:col-span-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar lote, modelo, notas…" className="pl-9" />
          </div>
          <FilterSelect icon={<Filter className="h-3.5 w-3.5" />} label="Modelo"
            value={model} onChange={setModel} options={[["all", "Todos los modelos"], ...models.map(m => [m, m] as [string, string])]} />
          <FilterSelect label="Cluster" value={cluster} onChange={setCluster}
            options={[["all", "Todos los clusters"], ...clusters.map(c => [c, c] as [string, string])]} />
          <FilterSelect label="Estatus" value={status} onChange={setStatus}
            options={[["all","Todos los estatus"],["Available","Disponible"],["Reserved","Apartado"],["Sold","Vendido"]]} />
        </div>

        <div className="overflow-x-auto -mx-4 md:-mx-5 border-y border-border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="pl-5 pr-2 py-2.5 w-10">
                  <Checkbox
                    checked={filtered.length > 0 && filtered.every(r => selected.has(r.id))}
                    onCheckedChange={(v) => toggleAllVisible(Boolean(v))}
                  />
                </th>
                <th className="px-2 py-2.5 font-medium">Lote</th>
                <th className="px-2 py-2.5 font-medium">Cluster</th>
                <th className="px-2 py-2.5 font-medium text-right">Precio (MXN)</th>
                <th className="px-2 py-2.5 font-medium">Entrega</th>
                <th className="px-2 py-2.5 font-medium">Estatus</th>
                <th className="px-2 py-2.5 font-medium">Notas</th>
                <th className="px-2 py-2.5 font-medium">Propiedad</th>
                <th className="px-5 py-2.5 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([modelName, items]) => (
                <ModelGroup
                  key={modelName}
                  model={modelName}
                  items={items}
                  editingId={editingId}
                  draft={draft}
                  setDraft={setDraft}
                  startEdit={startEdit}
                  cancelEdit={cancelEdit}
                  saveEdit={saveEdit}
                  selected={selected}
                  toggleRow={toggleRow}
                  quickMarkSold={quickMarkSold}
                  expanded={expanded}
                  toggleExpand={toggleExpand}
                />
              ))}
              {grouped.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-12">
                    Ninguna unidad coincide con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1 text-xs text-muted-foreground pt-3">
          <div className="flex items-center gap-1.5 min-w-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
            <span className="truncate">Cambios sincronizados al instante</span>
          </div>
          <div className="text-[11px]">Actualizado {new Date().toLocaleString("es-MX")}</div>
        </div>
      </PageCard>

      <BulkUpdateDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={selected.size}
        status={bulkStatus}
        setStatus={setBulkStatus}
        onApply={applyBulk}
      />

      <PdfPreviewDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        groups={grouped}
      />
    </AppShell>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function Stat({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return (
    <div className="px-3 py-1.5 rounded-lg bg-muted/60 text-center min-w-[68px]">
      <div className={cn("text-base font-semibold leading-none", tint)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function LegendItem({ tint, dot, label, help }: { tint: string; dot: string; label: string; help: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0", tint)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {label}
      </span>
      <p className="text-xs text-muted-foreground leading-snug">{help}</p>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options, icon,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: [string, string][]; icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground flex items-center gap-1">{icon}{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ModelGroup({
  model, items, editingId, draft, setDraft, startEdit, cancelEdit, saveEdit,
  selected, toggleRow, quickMarkSold, expanded, toggleExpand,
}: {
  model: string;
  items: AvailabilityRow[];
  editingId: string | null;
  draft: Partial<AvailabilityRow>;
  setDraft: (d: Partial<AvailabilityRow>) => void;
  startEdit: (r: AvailabilityRow) => void;
  cancelEdit: () => void;
  saveEdit: (id: string) => void;
  selected: Set<string>;
  toggleRow: (id: string, on: boolean) => void;
  quickMarkSold: (r: AvailabilityRow) => void;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
}) {
  const avg = items.reduce((s, r) => s + r.price, 0) / items.length;
  return (
    <>
      <tr className="bg-primary/[0.04] border-y border-primary/15">
        <td colSpan={9} className="px-5 py-2.5">
          <div className="flex items-center gap-3">
            <ChevronDown className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-sm tracking-tight">{model}</span>
            <span className="text-[11px] text-muted-foreground">{items.length} unidades</span>
            <span className="ml-auto text-[11px] text-muted-foreground">
              prom. <span className="font-medium text-foreground">{fmtMXN(avg)}</span>
            </span>
          </div>
        </td>
      </tr>
      {items.map((r) => {
        const editing = editingId === r.id;
        const isSel = selected.has(r.id);
        const isOpen = expanded.has(r.id);
        const history = (r.history ?? []).slice(-5).reverse();
        return (
          <Fragment key={r.id}>
            <tr className={cn("border-b border-border/60 hover:bg-muted/30", isSel && "bg-primary/[0.03]", isOpen && "bg-muted/20")}>
              <td className="pl-5 pr-2 py-2.5">
                <Checkbox checked={isSel} onCheckedChange={(v) => toggleRow(r.id, Boolean(v))} />
              </td>
              <td className="px-2 py-2.5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => toggleExpand(r.id)}
                  className="inline-flex items-center gap-1 hover:text-primary transition-colors"
                  aria-expanded={isOpen}
                  aria-label={isOpen ? `Ocultar historial de ${r.lot}` : `Ver historial de ${r.lot}`}
                >
                  {isOpen
                    ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
                    : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  {r.lot}
                </button>
              </td>
              <td className="px-2 py-2.5 text-muted-foreground">{r.cluster}</td>
              <td className="px-2 py-2.5 text-right font-medium tabular-nums">
                {editing ? (
                  <Input type="number" className="h-8 text-right tabular-nums"
                    value={draft.price ?? r.price}
                    onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} />
                ) : fmtMXN(r.price)}
              </td>
              <td className="px-2 py-2.5">
                {editing ? (
                  <Input type="date" className="h-8"
                    value={(draft.delivery ?? r.delivery).slice(0, 10)}
                    onChange={(e) => setDraft({ ...draft, delivery: e.target.value })} />
                ) : (
                  <span className="text-xs">{new Date(r.delivery).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</span>
                )}
              </td>
              <td className="px-2 py-2.5">
                {editing ? (
                  <Select value={(draft.status ?? r.status) as string}
                    onValueChange={(v) => setDraft({ ...draft, status: v as AvailabilityStatus })}>
                    <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Available">Disponible</SelectItem>
                      <SelectItem value="Reserved">Apartado</SelectItem>
                      <SelectItem value="Sold">Vendido</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_TINTS[r.status])}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[r.status])} />
                    {r.status === "Available" ? "Disponible" : r.status === "Reserved" ? "Apartado" : "Vendido"}
                  </span>
                )}
              </td>
              <td className="px-2 py-2.5 max-w-[220px]">
                {editing ? (
                  <Input className="h-8" value={draft.notes ?? r.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                ) : <span className="text-xs text-muted-foreground truncate block">{r.notes}</span>}
              </td>
              <td className="px-2 py-2.5">
                {r.propertyId
                  ? <span className="font-mono text-[11px] text-primary">{r.propertyId}</span>
                  : <span className="text-[11px] text-muted-foreground italic">sin asignar</span>}
              </td>
              <td className="px-5 py-2.5 text-right">
                {editing ? (
                  <div className="inline-flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit} aria-label="Cancelar"><X className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" className="h-7 px-2 gap-1" onClick={() => saveEdit(r.id)}>
                      <Save className="h-3.5 w-3.5" /> Guardar
                    </Button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1">
                    {r.status !== "Sold" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 gap-1 text-[11px] border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                        onClick={() => quickMarkSold(r)}
                        aria-label={`Marcar lote ${r.lot} como vendido`}
                      >
                        <CircleDollarSign className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Marcar Vendido</span>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(r)} aria-label="Editar">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </td>
            </tr>
            {isOpen && (
              <tr className="border-b border-border/60 bg-muted/10">
                <td colSpan={9} className="px-5 py-3">
                  <HistoryLog entries={history} lot={r.lot} />
                </td>
              </tr>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

/* ───────────── History log ───────────── */

function HistoryLog({
  entries,
  lot,
}: {
  entries: { at: string; from: AvailabilityStatus; to: AvailabilityStatus; agentId: string }[];
  lot: string;
}) {
  const statusEs = (s: AvailabilityStatus) =>
    s === "Available" ? "Disponible" : s === "Reserved" ? "Apartado" : "Vendido";
  const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <div className="flex items-center gap-2 mb-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">Historial de cambios — Lote {lot}</span>
        <span className="text-[11px] text-muted-foreground">últimos {entries.length} de máx. 5</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-1 py-2">
          Sin cambios de estatus registrados todavía.
        </p>
      ) : (
        <ol className="relative border-l border-border/70 ml-1.5 space-y-2.5 pl-4">
          {entries.map((e, i) => (
            <li key={i} className="relative">
              <span className={cn("absolute -left-[21px] top-1 h-2 w-2 rounded-full ring-2 ring-background", STATUS_DOT[e.to])} />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_TINTS[e.from])}>
                  {statusEs(e.from)}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium", STATUS_TINTS[e.to])}>
                  {statusEs(e.to)}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <UserIcon className="h-3 w-3" />
                  {agentName(e.agentId)}
                </span>
                <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
                  {new Date(e.at).toLocaleString("es-MX", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ───────────── Bulk update ───────────── */

function BulkUpdateDialog({
  open, onOpenChange, count, status, setStatus, onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  status: AvailabilityStatus;
  setStatus: (s: AvailabilityStatus) => void;
  onApply: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actualización en lote de disponibilidad</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {count} unidad(es) seleccionada(s) serán actualizadas y enviadas a todas las propiedades vinculadas y a la app móvil.
        </p>
        <div className="space-y-2">
          <Label>Nuevo estatus</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as AvailabilityStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Available">Disponible</SelectItem>
              <SelectItem value="Reserved">Apartado</SelectItem>
              <SelectItem value="Sold">Vendido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <pre className="rounded-md bg-muted/60 px-3 py-2 text-[11px] font-mono text-muted-foreground overflow-x-auto">
{`UPDATE availability_master
   SET status = '${status}', updated_at = NOW()
 WHERE id IN (${count} ids);`}
        </pre>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onApply} disabled={count === 0}>Aplicar y sincronizar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── PDF Preview ───────────── */

function PdfPreviewDialog({
  open, onOpenChange, groups,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  groups: [string, AvailabilityRow[]][];
}) {
  const totalUnits = groups.reduce((s, [, items]) => s + items.length, 0);
  const today = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  // Stable folio per dialog mount
  const folio = useMemo(
    () => `SAL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    [open],
  );
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  async function generatePdfBlob() {
    const [{ pdf }, { AvailabilityPdfDoc }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/components/availability/AvailabilityPdfDoc"),
    ]);
    return pdf(
      <AvailabilityPdfDoc groups={groups} folio={folio} dateLabel={today} />,
    ).toBlob();
  }

  async function handleDownload() {
    try {
      setDownloading(true);
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Salgon_Disponibilidad_${folio}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado", { description: `${a.download}` });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar el PDF", {
        description: err instanceof Error ? err.message : "Intenta nuevamente.",
      });
    } finally {
      setDownloading(false);
    }
  }

  async function handleSendWhatsapp() {
    try {
      setSending(true);
      const blob = await generatePdfBlob();
      const dataUrl = await blobToDataUrl(blob);
      const filename = `Salgon_Disponibilidad_${folio}.pdf`;
      const message =
        `Hola {{name}}, le compartimos el reporte oficial de disponibilidad de Salgon Bienes Raíces ` +
        `(folio ${folio}, ${totalUnits} unidades) con fecha ${today}. ` +
        `Encuentre adjunto el PDF con precios en MXN, fechas de entrega y observaciones de cada unidad. ` +
        `Quedamos atentos para agendar una visita o resolver cualquier duda.`;
      setWhatsappHandoff({
        message,
        attachment: { filename, dataUrl, sizeBytes: blob.size },
        meta: { folio, totalUnits },
      });
      toast.success("PDF listo para enviar", {
        description: `Abriendo WhatsApp con ${filename} adjunto`,
      });
      onOpenChange(false);
      navigate({ to: "/whatsapp" });
    } catch (err) {
      console.error(err);
      toast.error("No se pudo preparar el envío", {
        description: err instanceof Error ? err.message : "Intenta nuevamente.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[100vw] sm:w-auto h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden p-0 gap-0 sm:rounded-2xl rounded-none">
        <DialogHeader className="px-4 md:px-6 pt-4 md:pt-5 pb-3 border-b border-border space-y-0">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-sm md:text-base">Vista previa de PDF · Reporte de Disponibilidad</DialogTitle>
              <p className="text-[11px] md:text-xs text-muted-foreground mt-0.5">Documento oficial para envío a clientes</p>
            </div>
            <div className="flex items-center gap-2 md:mr-8">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 md:flex-none gap-1.5 border-success/40 text-success hover:bg-success/10 hover:text-success"
                onClick={handleSendWhatsapp}
                disabled={sending || downloading}
              >
                <Send className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{sending ? "Preparando…" : "Enviar PDF por WhatsApp"}</span>
                <span className="sm:hidden">{sending ? "…" : "WhatsApp"}</span>
              </Button>
              <Button size="sm" className="flex-1 md:flex-none gap-1.5" onClick={handleDownload} disabled={downloading || sending}>
                <Printer className="h-3.5 w-3.5" /> {downloading ? "Generando…" : "Descargar PDF"}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto bg-neutral-200 p-6">
          {/* The "paper" */}
          <div className="mx-auto bg-white shadow-2xl text-neutral-900" style={{ width: "100%", maxWidth: 780 }}>
            {/* Header bar */}
            <div className="flex items-stretch border-b-4 border-[#1f4d3a]">
              <div className="flex items-center gap-3 px-7 py-5 flex-1">
                <div className="h-12 w-12 rounded bg-[#1f4d3a] text-white grid place-items-center font-bold text-xl tracking-tight">S</div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Salgon Real Estate</div>
                  <div className="text-xl font-semibold tracking-tight text-[#1f4d3a]">Reporte de Disponibilidad</div>
                </div>
              </div>
              <div className="px-7 py-5 text-right border-l border-neutral-200">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Fecha de emisión</div>
                <div className="text-sm font-medium">{today}</div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-2">Folio</div>
                <div className="text-sm font-mono">{folio}</div>
              </div>
            </div>

            {/* Intro */}
            <div className="px-7 pt-5 pb-2 text-[11px] text-neutral-600 leading-relaxed">
              Estimado cliente, a continuación se presenta la disponibilidad vigente de unidades en nuestros desarrollos.
              Precios expresados en pesos mexicanos (MXN) y sujetos a cambio sin previo aviso.
            </div>

            {/* Tables per model */}
            <div className="px-7 py-4 space-y-5">
              {groups.map(([model, items]) => (
                <section key={model}>
                  <div className="flex items-baseline justify-between border-b-2 border-[#1f4d3a] pb-1.5 mb-1.5">
                    <h3 className="text-[13px] font-semibold tracking-wide text-[#1f4d3a] uppercase">Modelo {model}</h3>
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">{items.length} unidades</span>
                  </div>
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="text-left text-neutral-500 uppercase tracking-wider text-[9px] border-b border-neutral-300">
                        <th className="py-1.5 pr-3 font-medium w-14">Lote</th>
                        <th className="py-1.5 pr-3 font-medium">Cluster</th>
                        <th className="py-1.5 pr-3 font-medium text-right whitespace-nowrap">Precio MXN</th>
                        <th className="py-1.5 pr-3 font-medium whitespace-nowrap">Entrega</th>
                        <th className="py-1.5 pr-3 font-medium w-24">Estatus</th>
                        <th className="py-1.5 font-medium">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r, i) => (
                        <tr key={r.id} className={i % 2 ? "bg-neutral-50" : ""}>
                          <td className="py-1.5 pr-3 font-mono">{r.lot}</td>
                          <td className="py-1.5 pr-3">{r.cluster}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums font-medium whitespace-nowrap">{fmtMXN(r.price)}</td>
                          <td className="py-1.5 pr-3 whitespace-nowrap">{new Date(r.delivery).toLocaleDateString("es-MX", { month: "short", year: "numeric" })}</td>
                          <td className="py-1.5 pr-3">
                            <span className={cn("inline-block px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider",
                              r.status === "Available" && "bg-emerald-100 text-emerald-800",
                              r.status === "Reserved"  && "bg-amber-100  text-amber-900",
                              r.status === "Sold"      && "bg-rose-100   text-rose-800",
                            )}>
                              {r.status === "Available" ? "Disponible" : r.status === "Reserved" ? "Apartada" : "Vendida"}
                            </span>
                          </td>
                          <td className="py-1.5 text-neutral-600">{r.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}
            </div>

            {/* Footnotes */}
            <div className="px-7 py-4 border-t border-neutral-200 mt-4 text-[9px] text-neutral-500 leading-relaxed space-y-1">
              <p><span className="font-semibold text-neutral-700">Notas:</span> "Entrega inmediata" no aplica a unidades en proceso de escrituración. "X meses firma" indica el plazo estimado de entrega a partir de la firma del contrato.</p>
              <p>Esta cotización tiene una vigencia de 15 días naturales. Reservaciones sujetas a disponibilidad y aprobación crediticia. Precios no incluyen gastos de escrituración, avalúo ni notariales.</p>
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-200 text-[9px] text-neutral-400">
                <span>Salgon Real Estate · Inventario Centralizado · {totalUnits} unidades</span>
                <span>Documento generado por sistema · página 1 de 1</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
