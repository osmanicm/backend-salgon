import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Search, Pencil, Trash2, Eye, MapPin, Upload, RefreshCw, Share2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { agents, fmtMoney, type Property } from "@/data/mock";
import { useProperties } from "@/data/store";
import { setWhatsappHandoff } from "@/data/whatsappHandoff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/properties")({ component: PropertiesPage });

function PropertiesPage() {
  const properties = useProperties();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const flashed = useFlashedProperties(properties);

  const filtered = properties.filter((p) => {
    const matchesQ = (p.title + p.location + p.id).toLowerCase().includes(q.toLowerCase());
    const matchesS = status === "all" || p.status === status;
    return matchesQ && matchesS;
  });

  return (
    <AppShell title="Propiedades" subtitle="Administra tu catálogo de propiedades">
      <PageCard
        title="Todas las Propiedades"
        description={`${filtered.length} de ${properties.length} listados`}
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
            <div className="hidden md:block">
              <AddPropertyDialog />
            </div>
          </div>
        }
      >
        {/* Mobile: card list */}
        <ul className="md:hidden space-y-3">
          {filtered.map((p) => {
            const agent = agents.find((a) => a.id === p.agentId);
            return (
              <li
                key={p.id}
                className={cn(
                  "rounded-2xl border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)] transition-colors",
                  flashed.has(p.id) && "ring-1 ring-success/40",
                )}
              >
                <div className="relative">
                  <img src={p.image} alt={p.title} className="h-40 w-full object-cover" />
                  <div className="absolute top-2 left-2"><StatusBadge status={p.status} /></div>
                  {flashed.has(p.id) && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-medium text-success bg-card/90 backdrop-blur rounded-full px-2 py-0.5">
                      <RefreshCw className="h-3 w-3 animate-spin" /> sincronizado
                    </span>
                  )}
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
                      <div className="text-base font-semibold text-primary tabular-nums">{fmtMoney(p.price)}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{p.id}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-2">
                    {p.bedrooms} rec · {p.bathrooms} baños · {p.area} m² · {agent?.name}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5"><Eye className="h-3.5 w-3.5" /> Ver</Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5"><Pencil className="h-3.5 w-3.5" /> Editar</Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive shrink-0" aria-label="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="text-center text-sm text-muted-foreground py-12">
              No se encontraron propiedades.
            </li>
          )}
        </ul>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-medium">Propiedad</th>
                <th className="px-3 py-3 font-medium">ID</th>
                <th className="px-3 py-3 font-medium">Precio</th>
                <th className="px-3 py-3 font-medium">Ubicación</th>
                <th className="px-3 py-3 font-medium">Estatus</th>
                <th className="px-3 py-3 font-medium">Agente</th>
                <th className="px-5 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const agent = agents.find((a) => a.id === p.agentId);
                return (
                  <tr
                    key={p.id}
                    className={cn(
                      "border-b border-border/60 hover:bg-muted/40 transition-colors",
                      flashed.has(p.id) && "bg-success/10 ring-1 ring-success/40",
                    )}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.image} alt={p.title} className="h-11 w-14 rounded-md object-cover" />
                        <div>
                          <div className="font-medium">{p.title}</div>
                          <div className="text-xs text-muted-foreground">{p.bedrooms} rec · {p.bathrooms} baños · {p.area} m²</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{p.id}</td>
                    <td className="px-3 py-3 font-medium">{fmtMoney(p.price)}</td>
                    <td className="px-3 py-3"><span className="inline-flex items-center gap-1 text-muted-foreground"><MapPin className="h-3 w-3" />{p.location}</span></td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <StatusBadge status={p.status} />
                        {flashed.has(p.id) && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success">
                            <RefreshCw className="h-3 w-3 animate-spin" /> sincronizado
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3">{agent?.name}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ver"><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageCard>

      {/* Mobile FAB */}
      <div className="md:hidden fixed right-4 z-30" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}>
        <AddPropertyFab />
      </div>
    </AppShell>
  );
}

function AddPropertyFab() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" className="h-14 w-14 rounded-full shadow-[var(--shadow-elevated)] bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition" aria-label="Agregar propiedad">
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <AddPropertyDialogContent />
    </Dialog>
  );
}

function AddPropertyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="h-4 w-4" /> Agregar Propiedad</Button>
      </DialogTrigger>
      <AddPropertyDialogContent />
    </Dialog>
  );
}

function AddPropertyDialogContent() {
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Agregar nueva propiedad</DialogTitle></DialogHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-1.5"><Label>Título</Label><Input placeholder="Penthouse Vista al Mar" /></div>
        <div className="sm:col-span-2 space-y-1.5"><Label>Descripción</Label><Textarea placeholder="Describe la propiedad…" rows={3} /></div>
        <div className="space-y-1.5"><Label>Precio (MXN)</Label><Input type="number" placeholder="3500000" /></div>
        <div className="space-y-1.5"><Label>Estatus</Label>
          <Select defaultValue="Available">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Available">Disponible</SelectItem>
              <SelectItem value="Reserved">Apartado</SelectItem>
              <SelectItem value="Sold">Vendido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-1.5"><Label>Ubicación</Label><Input placeholder="CDMX, Polanco" />
          <div className="mt-2 h-28 rounded-lg border border-dashed border-border bg-muted/40 grid place-items-center text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Mapa (vista previa)</span>
          </div>
        </div>
        <div className="space-y-1.5"><Label>Agente Asignado</Label>
          <Select>
            <SelectTrigger><SelectValue placeholder="Selecciona un agente" /></SelectTrigger>
            <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Imagen</Label>
          <div className="h-10 rounded-md border border-dashed border-border grid place-items-center text-xs text-muted-foreground gap-1.5 cursor-pointer hover:bg-muted/40">
            <span className="inline-flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Subir imagen</span>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline">Cancelar</Button>
        <Button>Crear propiedad</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * Detect properties whose status changed since last render and flash them
 * for ~2.5s with a "synced" indicator. Mirrors the visual feedback the
 * Flutter app would show when receiving a /api/properties push.
 */
function useFlashedProperties(properties: Property[]) {
  const prev = useRef<Map<string, string>>(new Map());
  const [flashed, setFlashed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const changed = new Set<string>();
    properties.forEach((p) => {
      const last = prev.current.get(p.id);
      if (last !== undefined && last !== p.status) changed.add(p.id);
      prev.current.set(p.id, p.status);
    });
    if (changed.size === 0) return;
    setFlashed((s) => new Set([...s, ...changed]));
    const t = setTimeout(() => {
      setFlashed((s) => {
        const next = new Set(s);
        changed.forEach((id) => next.delete(id));
        return next;
      });
    }, 2500);
    return () => clearTimeout(t);
  }, [properties]);

  return flashed;
}
