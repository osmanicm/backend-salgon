import { createFileRoute } from "@tanstack/react-router";
import { Plus, Phone, Mail } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { agents, leads, fmtMoney } from "@/data/mock";

export const Route = createFileRoute("/leads")({ component: LeadsPage });

const SOURCE_ES: Record<string, string> = {
  Website: "Sitio Web",
  WhatsApp: "WhatsApp",
  Referral: "Referido",
  "Walk-in": "Visita en oficina",
  Facebook: "Facebook",
};

function LeadsPage() {
  return (
    <AppShell title="Prospectos y Clientes" subtitle="Da seguimiento y califica a tus clientes potenciales">
      <PageCard
        title="Todos los Prospectos"
        description={`${leads.length} prospectos activos`}
        action={<AddLeadDialog />}
      >
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-3 py-3 font-medium">Contacto</th>
                <th className="px-3 py-3 font-medium">Interés</th>
                <th className="px-3 py-3 font-medium">Presupuesto</th>
                <th className="px-3 py-3 font-medium">Origen</th>
                <th className="px-3 py-3 font-medium">Estatus</th>
                <th className="px-5 py-3 font-medium">Agente</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const agent = agents.find((a) => a.id === l.agentId);
                return (
                  <tr key={l.id} className="border-b border-border/60 hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <div className="font-medium">{l.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{l.id}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</div>
                    </td>
                    <td className="px-3 py-3">{l.interest}</td>
                    <td className="px-3 py-3 font-medium">{fmtMoney(l.budget)}</td>
                    <td className="px-3 py-3"><span className="text-xs px-2 py-0.5 rounded-md bg-muted">{SOURCE_ES[l.source] ?? l.source}</span></td>
                    <td className="px-3 py-3"><StatusBadge status={l.status} /></td>
                    <td className="px-5 py-3">{agent?.name}</td>
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

function AddLeadDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild><Button className="gap-1.5"><Plus className="h-4 w-4" /> Agregar Prospecto</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Agregar nuevo prospecto</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Nombre completo</Label><Input placeholder="Juan Pérez" /></div>
          <div className="space-y-1.5"><Label>Teléfono</Label><Input placeholder="+52 55 0000 0000" /></div>
          <div className="col-span-2 space-y-1.5"><Label>Correo electrónico</Label><Input type="email" placeholder="correo@ejemplo.com" /></div>
          <div className="col-span-2 space-y-1.5"><Label>Interés</Label><Input placeholder="Casa de 3 recámaras en Polanco" /></div>
          <div className="space-y-1.5"><Label>Presupuesto (MXN)</Label><Input type="number" placeholder="2500000" /></div>
          <div className="space-y-1.5"><Label>Origen</Label>
            <Select><SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Website">Sitio Web</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Referral">Referido</SelectItem>
                <SelectItem value="Walk-in">Visita en oficina</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Estatus</Label>
            <Select defaultValue="New"><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="New">Nuevo</SelectItem>
                <SelectItem value="Contacted">Contactado</SelectItem>
                <SelectItem value="Visit">Visita</SelectItem>
                <SelectItem value="Negotiation">Negociación</SelectItem>
                <SelectItem value="Closed">Cerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Agente asignado</Label>
            <Select><SelectTrigger><SelectValue placeholder="Selecciona un agente" /></SelectTrigger>
              <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button variant="outline">Cancelar</Button><Button>Guardar prospecto</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
