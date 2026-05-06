import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Phone, Mail, MessageCircle, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useLeads, useCreateLead, type LeadSource, type LeadStatus } from "@/data/leadsApi";
import { useAgentsList } from "@/data/propertiesApi";
import { useAuth } from "@/hooks/useAuth";
import { fmtMoney } from "@/data/mock";
import { cn } from "@/lib/utils";

import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/leads")({
  component: LeadsPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Leads" error={error} reset={reset} />,
});

const SOURCE_ES: Record<string, string> = {
  Website: "Sitio Web",
  WhatsApp: "WhatsApp",
  Referral: "Referido",
  "Walk-in": "Visita en oficina",
  Facebook: "Facebook",
};

function LeadsPage() {
  const { data: leads = [], isLoading } = useLeads();

  return (
    <AppShell title="Prospectos y Clientes" subtitle="Da seguimiento y califica a tus clientes potenciales">
      <PageCard
        title="Todos los Prospectos"
        description={isLoading ? "Cargando…" : `${leads.length} prospectos`}
        action={<div className="hidden md:block"><AddLeadDialog /></div>}
      >
        {!isLoading && leads.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Aún no tienes prospectos. Crea el primero con “Agregar Prospecto”.
          </div>
        ) : null}

        {/* Mobile: card list */}
        <ul className="md:hidden space-y-3">
          {leads.map((l) => {
            const initials = l.name.split(" ").map(n => n[0]).slice(0, 2).join("");
            return (
              <li key={l.id} className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-full bg-primary/10 text-primary grid place-items-center text-sm font-semibold shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm truncate">{l.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{l.interest}</div>
                      </div>
                      <StatusBadge status={l.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-primary tabular-nums">{fmtMoney(Number(l.budget))}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{SOURCE_ES[l.source] ?? l.source}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1.5 truncate">Agente · {l.agent?.full_name ?? "—"}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border text-xs font-medium hover:bg-muted/40 active:scale-95 transition">
                    <Phone className="h-3.5 w-3.5" /> Llamar
                  </a>
                  <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 h-9 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/15 active:scale-95 transition">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                  <a href={`mailto:${l.email}`} className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border text-xs font-medium hover:bg-muted/40 active:scale-95 transition">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </a>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto -mx-5">
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
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-border/60 hover:bg-muted/40">
                  <td className="px-5 py-3">
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{l.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</div>
                  </td>
                  <td className="px-3 py-3">{l.interest}</td>
                  <td className="px-3 py-3 font-medium">{fmtMoney(Number(l.budget))}</td>
                  <td className="px-3 py-3"><span className="text-xs px-2 py-0.5 rounded-md bg-muted">{SOURCE_ES[l.source] ?? l.source}</span></td>
                  <td className="px-3 py-3"><StatusBadge status={l.status} /></td>
                  <td className="px-5 py-3">{l.agent?.full_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageCard>

      {/* Mobile FAB */}
      <div className="md:hidden fixed right-4 z-30" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}>
        <AddLeadFab />
      </div>
    </AppShell>
  );
}

const leadSchema = z.object({
  name: z.string().trim().min(2, "Nombre requerido (mín. 2)").max(100),
  phone: z.string().trim().min(7, "Teléfono inválido").max(25).regex(/^[+\d\s().-]+$/, "Solo dígitos y +()-. permitidos"),
  email: z.string().trim().email("Correo inválido").max(255),
  interest: z.string().trim().min(3, "Describe el interés").max(200),
  budget: z.number({ invalid_type_error: "Presupuesto requerido" }).int().positive().max(1_000_000_000),
  source: z.string().min(1),
  status: z.string().min(1),
  agent_id: z.string().min(1, "Selecciona agente"),
});

type LeadForm = { name: string; phone: string; email: string; interest: string; budget: string; source: string; status: string; agent_id: string };
const emptyLead = (uid?: string): LeadForm => ({ name: "", phone: "", email: "", interest: "", budget: "", source: "Website", status: "New", agent_id: uid ?? "" });

function AddLeadFab() {
  return <AddLeadDialog trigger={
    <Button size="icon" aria-label="Agregar prospecto" className="h-14 w-14 rounded-full shadow-[var(--shadow-elevated)]">
      <Plus className="h-6 w-6" />
    </Button>
  } />;
}

function AddLeadDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const agentsQuery = useAgentsList();
  const create = useCreateLead();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(emptyLead(user?.id));
  const [errors, setErrors] = useState<Partial<Record<keyof LeadForm, string>>>({});

  function update<K extends keyof LeadForm>(key: K, value: LeadForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = leadSchema.safeParse({ ...form, budget: form.budget === "" ? Number.NaN : Number(form.budget) });
    if (!parsed.success) {
      const fe: Partial<Record<keyof LeadForm, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof LeadForm;
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      toast.error(parsed.error.issues[0].message);
      return;
    }
    try {
      await create.mutateAsync({
        agent_id: parsed.data.agent_id,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        interest: parsed.data.interest,
        budget: parsed.data.budget,
        source: parsed.data.source as LeadSource,
        status: parsed.data.status as LeadStatus,
      });
      toast.success("Prospecto guardado");
      setForm(emptyLead(user?.id));
      setErrors({});
      setOpen(false);
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? "No se pudo guardar el prospecto");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setErrors({}); }}>
      <DialogTrigger asChild>
        {trigger ?? <Button className="gap-1.5"><Plus className="h-4 w-4" /> Agregar Prospecto</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Agregar nuevo prospecto</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="grid grid-cols-2 gap-4">
          <FormField label="Nombre completo *" error={errors.name}>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Juan Pérez" maxLength={100} />
          </FormField>
          <FormField label="Teléfono *" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+52 55 0000 0000" maxLength={25} />
          </FormField>
          <FormField label="Correo electrónico *" error={errors.email} className="col-span-2">
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="correo@ejemplo.com" maxLength={255} />
          </FormField>
          <FormField label="Interés *" error={errors.interest} className="col-span-2">
            <Input value={form.interest} onChange={(e) => update("interest", e.target.value)} placeholder="Casa de 3 recámaras en Polanco" maxLength={200} />
          </FormField>
          <FormField label="Presupuesto (MXN) *" error={errors.budget}>
            <Input type="number" min="1" step="1" value={form.budget} onChange={(e) => update("budget", e.target.value)} placeholder="2500000" />
          </FormField>
          <FormField label="Origen *" error={errors.source}>
            <Select value={form.source} onValueChange={(v) => update("source", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Website">Sitio Web</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Referral">Referido</SelectItem>
                <SelectItem value="Walk-in">Visita en oficina</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Estatus *" error={errors.status}>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="New">Nuevo</SelectItem>
                <SelectItem value="Contacted">Contactado</SelectItem>
                <SelectItem value="Visit">Visita</SelectItem>
                <SelectItem value="Negotiation">Negociación</SelectItem>
                <SelectItem value="Closed">Cerrado</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Agente asignado *" error={errors.agent_id} className="col-span-2">
            <Select value={form.agent_id} onValueChange={(v) => update("agent_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona un agente" /></SelectTrigger>
              <SelectContent>
                {(agentsQuery.data ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.full_name ?? a.email ?? a.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Guardar prospecto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ label, error, className, children }: { label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
