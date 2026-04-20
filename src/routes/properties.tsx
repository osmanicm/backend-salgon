import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Search, Pencil, Trash2, Eye, MapPin, Upload, RefreshCw } from "lucide-react";
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
    <AppShell title="Properties" subtitle="Manage your property listings">
      <PageCard
        title="All Properties"
        description={`${filtered.length} of ${properties.length} listings`}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9 w-56" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Reserved">Reserved</SelectItem>
                <SelectItem value="Sold">Sold</SelectItem>
              </SelectContent>
            </Select>
            <AddPropertyDialog />
          </div>
        }
      >
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-medium">Property</th>
                <th className="px-3 py-3 font-medium">ID</th>
                <th className="px-3 py-3 font-medium">Price</th>
                <th className="px-3 py-3 font-medium">Location</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3 font-medium">Agent</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
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
                          <div className="text-xs text-muted-foreground">{p.bedrooms} bd · {p.bathrooms} ba · {p.area} m²</div>
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
                            <RefreshCw className="h-3 w-3 animate-spin" /> synced
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-3">{agent?.name}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PageCard>
    </AppShell>
  );
}

function AddPropertyDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="h-4 w-4" /> Add Property</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Add new property</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5"><Label>Title</Label><Input placeholder="Sea View Penthouse" /></div>
          <div className="col-span-2 space-y-1.5"><Label>Description</Label><Textarea placeholder="Describe the property…" rows={3} /></div>
          <div className="space-y-1.5"><Label>Price (USD)</Label><Input type="number" placeholder="350000" /></div>
          <div className="space-y-1.5"><Label>Status</Label>
            <Select defaultValue="Available">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Available">Available</SelectItem>
                <SelectItem value="Reserved">Reserved</SelectItem>
                <SelectItem value="Sold">Sold</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1.5"><Label>Location</Label><Input placeholder="Beirut, Achrafieh" />
            <div className="mt-2 h-32 rounded-lg border border-dashed border-border bg-muted/40 grid place-items-center text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" /> Map placeholder</span>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Assigned Agent</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Image</Label>
            <div className="h-10 rounded-md border border-dashed border-border grid place-items-center text-xs text-muted-foreground gap-1.5 cursor-pointer hover:bg-muted/40">
              <span className="inline-flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" /> Upload image</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Create property</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
