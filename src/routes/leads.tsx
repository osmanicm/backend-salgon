import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Phone, Mail, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { agents, leads, fmtMoney } from "@/data/mock";
import { cn } from "@/lib/utils";

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
        action={<div className="hidden md:block"><AddLeadDialog /></div>}
      >
        {/* Mobile: card list */}
        <ul className="md:hidden space-y-3">
          {leads.map((l) => {
            const agent = agents.find((a) => a.id === l.agentId);
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
                      <span className="text-sm font-semibold text-primary tabular-nums">{fmtMoney(l.budget)}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">{SOURCE_ES[l.source] ?? l.source}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1.5 truncate">Agente · {agent?.name}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a
                    href={`tel:${l.phone.replace(/\s/g, "")}`}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border text-xs font-medium hover:bg-muted/40 active:scale-95 transition"
                  >
                    <Phone className="h-3.5 w-3.5" /> Llamar
                  </a>
                  <a
                    href={`https://wa.me/${l.phone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/15 active:scale-95 transition"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                  <a
                    href={`mailto:${l.email}`}
                    className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-border text-xs font-medium hover:bg-muted/40 active:scale-95 transition"
                  >
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

      {/* Mobile FAB */}
      <div className="md:hidden fixed right-4 z-30" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}>
        <Link
          to="/leads"
          aria-label="Agregar prospecto"
          className="h-14 w-14 grid place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-elevated)] hover:bg-primary/90 active:scale-95 transition"
        >
          <Plus className="h-6 w-6" />
        </Link>
      </div>
    </AppShell>
  );
}

const leadSchema = z.object({
  name: z.string().trim().min(2, "Nombre requerido (mín. 2)").max(100, "Máx. 100"),
  phone: z
    .string()
    .trim()
    .min(7, "Teléfono inválido")
    .max(25, "Máx. 25")
    .regex(/^[+\d\s().-]+$/, "Solo dígitos y +()-. permitidos"),
  email: z.string().trim().email("Correo inválido").max(255, "Máx. 255"),
  interest: z.string().trim().min(3, "Describe el interés").max(200, "Máx. 200"),
  budget: z
    .number({ invalid_type_error: "Presupuesto requerido" })
    .int("Solo enteros")
    .positive("Debe ser mayor a 0")
    .max(1_000_000_000, "Monto demasiado alto"),
  source: z.string().min(1, "Selecciona origen"),
  status: z.string().min(1, "Selecciona estatus"),
  agent_id: z.string().min(1, "Selecciona agente"),
});

type LeadForm = {
  name: string; phone: string; email: string; interest: string;
  budget: string; source: string; status: string; agent_id: string;
};
const emptyLead: LeadForm = {
  name: "", phone: "", email: "", interest: "",
  budget: "", source: "", status: "New", agent_id: "",
};

function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(emptyLead);
  const [errors, setErrors] = useState<Partial<Record<keyof LeadForm, string>>>({});

  function update<K extends keyof LeadForm>(key: K, value: LeadForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = leadSchema.safeParse({
      ...form,
      budget: form.budget === "" ? Number.NaN : Number(form.budget),
    });
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof LeadForm, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof LeadForm;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error(parsed.error.issues[0].message);
      return;
    }
    toast.success("Prospecto guardado");
    setForm(emptyLead);
    setErrors({});
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setErrors({}); }}>
      <DialogTrigger asChild><Button className="gap-1.5"><Plus className="h-4 w-4" /> Agregar Prospecto</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Agregar nuevo prospecto</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} noValidate className="grid grid-cols-2 gap-4">
          <FormField label="Nombre completo *" hint="Mínimo 2 caracteres" error={errors.name}>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Juan Pérez" maxLength={100} aria-invalid={!!errors.name} />
          </FormField>
          <FormField label="Teléfono *" hint="Formato: +52 55 0000 0000" error={errors.phone}>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+52 55 0000 0000" maxLength={25} aria-invalid={!!errors.phone} />
          </FormField>
          <FormField label="Correo electrónico *" hint="Ej. nombre@dominio.com" error={errors.email} className="col-span-2">
            <Input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="correo@ejemplo.com" maxLength={255} aria-invalid={!!errors.email} />
          </FormField>
          <FormField label="Interés *" hint="Describe qué busca (3–200 caracteres)" error={errors.interest} className="col-span-2">
            <Input value={form.interest} onChange={(e) => update("interest", e.target.value)} placeholder="Casa de 3 recámaras en Polanco" maxLength={200} aria-invalid={!!errors.interest} />
          </FormField>
          <FormField label="Presupuesto (MXN) *" hint="Entero positivo (máx. 1,000,000,000)" error={errors.budget}>
            <Input type="number" min="1" step="1" value={form.budget} onChange={(e) => update("budget", e.target.value)} placeholder="2500000" aria-invalid={!!errors.budget} />
          </FormField>
          <FormField label="Origen *" hint="¿De dónde vino el prospecto?" error={errors.source}>
            <Select value={form.source} onValueChange={(v) => update("source", v)}>
              <SelectTrigger aria-invalid={!!errors.source}><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Website">Sitio Web</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Referral">Referido</SelectItem>
                <SelectItem value="Walk-in">Visita en oficina</SelectItem>
                <SelectItem value="Facebook">Facebook</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Estatus *" hint="Etapa actual en el pipeline" error={errors.status}>
            <Select value={form.status} onValueChange={(v) => update("status", v)}>
              <SelectTrigger aria-invalid={!!errors.status}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="New">Nuevo</SelectItem>
                <SelectItem value="Contacted">Contactado</SelectItem>
                <SelectItem value="Visit">Visita</SelectItem>
                <SelectItem value="Negotiation">Negociación</SelectItem>
                <SelectItem value="Closed">Cerrado</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Agente asignado *" hint="Quién dará seguimiento" error={errors.agent_id}>
            <Select value={form.agent_id} onValueChange={(v) => update("agent_id", v)}>
              <SelectTrigger aria-invalid={!!errors.agent_id}><SelectValue placeholder="Selecciona un agente" /></SelectTrigger>
              <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit">Guardar prospecto</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({ label, hint, error, className, children }: { label: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
