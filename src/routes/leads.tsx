import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Phone, Mail, MessageCircle, Loader2, Pencil, Trash2, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead, type LeadRow, type LeadSource, type LeadStatus } from "@/data/leadsApi";
import { notifyNewLead } from "@/utils/notifications.functions";
import { useAgentsList } from "@/data/propertiesApi";
import { useAuth } from "@/hooks/useAuth";
import { fmtMoney } from "@/data/mock";
import { cn } from "@/lib/utils";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/leads")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s.q === "string" ? s.q : "" }),
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
  const { q: urlQ } = Route.useSearch();
  const { data: leads = [], isLoading } = useLeads();
  const [q, setQ] = useState(urlQ);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return leads.filter((l) => {
      const matchQ = !term || (
        l.name.toLowerCase().includes(term) ||
        l.email.toLowerCase().includes(term) ||
        l.phone.toLowerCase().includes(term) ||
        l.interest.toLowerCase().includes(term)
      );
      const matchS = statusFilter === "all" || l.status === statusFilter;
      return matchQ && matchS;
    });
  }, [leads, q, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => { setPage(1); }, [q, statusFilter, pageSize]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const pageStart = (page - 1) * pageSize;
  const paged = filtered.slice(pageStart, pageStart + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(filtered.length, pageStart + pageSize);

  return (
    <AppShell title="Prospectos y Clientes" subtitle="Da seguimiento y califica a tus clientes potenciales">
      <PageCard
        title="Todos los Prospectos"
        description={isLoading ? "Cargando…" : `${filtered.length}${filtered.length !== leads.length ? ` de ${leads.length}` : ""} prospectos`}
        action={
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, correo, interés…" className="pl-9 w-full md:w-56" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estatus</SelectItem>
                <SelectItem value="New">Nuevo</SelectItem>
                <SelectItem value="Contacted">Contactado</SelectItem>
                <SelectItem value="Visit">Visita</SelectItem>
                <SelectItem value="Negotiation">Negociación</SelectItem>
                <SelectItem value="Closed">Cerrado</SelectItem>
              </SelectContent>
            </Select>
            <div className="hidden md:block"><LeadFormDialog /></div>
          </div>
        }
      >
        {!isLoading && filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            {leads.length === 0
              ? "Aún no tienes prospectos. Crea el primero con \"Agregar Prospecto\"."
              : "Sin resultados para la búsqueda."}
          </div>
        ) : null}

        {/* Mobile: card list */}
        <ul className="md:hidden space-y-3">
          {paged.map((l) => <LeadCard key={l.id} lead={l} />)}
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
                <th className="px-3 py-3 font-medium">Agente</th>
                <th className="px-5 py-3 font-medium sr-only">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((l) => <LeadTableRow key={l.id} lead={l} />)}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm">
            <div className="text-muted-foreground">
              Mostrando <span className="font-medium text-foreground">{showingFrom}</span>–<span className="font-medium text-foreground">{showingTo}</span> de <span className="font-medium text-foreground">{filtered.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Por página</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>«</Button>
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Anterior</Button>
              <span className="text-xs text-muted-foreground tabular-nums px-1">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Siguiente</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>»</Button>
            </div>
          </div>
        )}
      </PageCard>

      {/* Mobile FAB */}
      <div className="md:hidden fixed right-4 z-30" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}>
        <LeadFormDialog trigger={
          <Button size="icon" aria-label="Agregar prospecto" className="h-14 w-14 rounded-full shadow-[var(--shadow-elevated)]">
            <Plus className="h-6 w-6" />
          </Button>
        } />
      </div>
    </AppShell>
  );
}

function LeadCard({ lead: l }: { lead: LeadRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const deleteLead = useDeleteLead();
  const initials = l.name.split(" ").map(n => n[0]).slice(0, 2).join("");

  async function handleDelete() {
    try {
      await deleteLead.mutateAsync(l.id);
      toast.success("Prospecto eliminado");
    } catch {
      toast.error("No se pudo eliminar el prospecto");
    }
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
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
            <div className="flex items-center gap-1 shrink-0">
              <StatusBadge status={l.status} />
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" aria-label="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </DialogTrigger>
                <LeadFormDialogContent lead={l} onClose={() => setEditOpen(false)} />
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" aria-label="Eliminar" disabled={deleteLead.isPending}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar prospecto?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminará el prospecto <strong>{l.name}</strong> de forma permanente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
}

function LeadTableRow({ lead: l }: { lead: LeadRow }) {
  const [editOpen, setEditOpen] = useState(false);
  const deleteLead = useDeleteLead();

  async function handleDelete() {
    try {
      await deleteLead.mutateAsync(l.id);
      toast.success("Prospecto eliminado");
    } catch {
      toast.error("No se pudo eliminar el prospecto");
    }
  }

  return (
    <tr className="border-b border-border/60 hover:bg-muted/40">
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
      <td className="px-5 py-3">
        <div className="flex items-center gap-1">
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" aria-label="Editar">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <LeadFormDialogContent lead={l} onClose={() => setEditOpen(false)} />
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Eliminar" disabled={deleteLead.isPending}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar prospecto?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará <strong>{l.name}</strong> de forma permanente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
    </tr>
  );
}

// ─── Schema & form ─────────────────────────────────────────────────────────────

const leadSchema = z.object({
  name: z.string().trim().min(2, "Nombre requerido (mín. 2)").max(100),
  phone: z.string().trim().min(7, "Teléfono inválido").max(25).regex(/^[+\d\s().-]+$/, "Solo dígitos y +()-. permitidos"),
  email: z.string().trim().email("Correo inválido").max(255),
  interest: z.string().trim().min(3, "Describe el interés").max(200),
  budget: z.number({ invalid_type_error: "Presupuesto requerido" }).int().positive().max(1_000_000_000),
  source: z.string().min(1),
  status: z.string().min(1),
  agent_id: z.string().min(1, "Selecciona agente"),
  notes: z.string().trim().max(1000).default(""),
});

type LeadForm = {
  name: string; phone: string; email: string; interest: string;
  budget: string; source: string; status: string; agent_id: string; notes: string;
};

const emptyLead = (uid?: string): LeadForm => ({
  name: "", phone: "", email: "", interest: "", budget: "",
  source: "Website", status: "New", agent_id: uid ?? "", notes: "",
});

function leadToForm(l: LeadRow): LeadForm {
  return {
    name: l.name,
    phone: l.phone,
    email: l.email,
    interest: l.interest,
    budget: String(l.budget),
    source: l.source,
    status: l.status,
    agent_id: l.agent_id,
    notes: l.notes ?? "",
  };
}

// ─── Shared dialog ─────────────────────────────────────────────────────────────

function LeadFormDialog({ trigger }: { trigger?: React.ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      <DialogTrigger asChild>
        {trigger ?? <Button className="gap-1.5"><Plus className="h-4 w-4" /> Agregar Prospecto</Button>}
      </DialogTrigger>
      <LeadFormDialogContent onClose={() => setOpen(false)} defaultAgentId={user?.id} />
    </Dialog>
  );
}

function LeadFormDialogContent({ lead, onClose, defaultAgentId }: { lead?: LeadRow; onClose?: () => void; defaultAgentId?: string }) {
  const isEdit = Boolean(lead);
  const { user } = useAuth();
  const agentsQuery = useAgentsList();
  const create = useCreateLead();
  const update = useUpdateLead();
  const [form, setForm] = useState<LeadForm>(lead ? leadToForm(lead) : emptyLead(defaultAgentId ?? user?.id));
  const [errors, setErrors] = useState<Partial<Record<keyof LeadForm, string>>>({});

  const isPending = create.isPending || update.isPending;

  function updateField<K extends keyof LeadForm>(key: K, value: LeadForm[K]) {
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
      if (isEdit && lead) {
        await update.mutateAsync({
          id: lead.id,
          patch: {
            name: parsed.data.name,
            phone: parsed.data.phone,
            email: parsed.data.email,
            interest: parsed.data.interest,
            budget: parsed.data.budget,
            source: parsed.data.source as LeadSource,
            status: parsed.data.status as LeadStatus,
            agent_id: parsed.data.agent_id,
            notes: parsed.data.notes,
          },
        });
        toast.success("Prospecto actualizado");
      } else {
        await create.mutateAsync({
          agent_id: parsed.data.agent_id,
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email,
          interest: parsed.data.interest,
          budget: parsed.data.budget,
          source: parsed.data.source as LeadSource,
          status: parsed.data.status as LeadStatus,
          notes: parsed.data.notes,
        });
        toast.success("Prospecto guardado");
        void notifyNewLead({ data: {
          name: parsed.data.name,
          phone: parsed.data.phone,
          email: parsed.data.email,
          interest: parsed.data.interest,
          budget: parsed.data.budget,
          source: parsed.data.source,
        } }).catch(() => {});
      }
      onClose?.();
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? (isEdit ? "No se pudo actualizar" : "No se pudo guardar el prospecto"));
    }
  }

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>{isEdit ? "Editar prospecto" : "Agregar nuevo prospecto"}</DialogTitle></DialogHeader>
      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-2 gap-4">
        <FormField label="Nombre completo *" error={errors.name}>
          <Input value={form.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Juan Pérez" maxLength={100} />
        </FormField>
        <FormField label="Teléfono *" error={errors.phone}>
          <Input value={form.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="+52 55 0000 0000" maxLength={25} />
        </FormField>
        <FormField label="Correo electrónico *" error={errors.email} className="col-span-2">
          <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} placeholder="correo@ejemplo.com" maxLength={255} />
        </FormField>
        <FormField label="Interés *" error={errors.interest} className="col-span-2">
          <Input value={form.interest} onChange={(e) => updateField("interest", e.target.value)} placeholder="Casa de 3 recámaras en Polanco" maxLength={200} />
        </FormField>
        <FormField label="Presupuesto (MXN) *" error={errors.budget}>
          <Input type="number" min="1" step="1" value={form.budget} onChange={(e) => updateField("budget", e.target.value)} placeholder="2500000" />
        </FormField>
        <FormField label="Origen *" error={errors.source}>
          <Select value={form.source} onValueChange={(v) => updateField("source", v)}>
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
          <Select value={form.status} onValueChange={(v) => updateField("status", v)}>
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
          <Select value={form.agent_id} onValueChange={(v) => updateField("agent_id", v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona un agente" /></SelectTrigger>
            <SelectContent>
              {(agentsQuery.data ?? []).map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.full_name ?? a.email ?? a.id}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Notas" error={errors.notes} className="col-span-2">
          <Textarea rows={3} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Observaciones adicionales…" maxLength={1000} />
        </FormField>
        <DialogFooter className="col-span-2">
          <Button type="button" variant="outline" onClick={() => onClose?.()}>Cancelar</Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            {isEdit ? "Guardar cambios" : "Guardar prospecto"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
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
