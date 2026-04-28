import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Calendar as CalIcon, List, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { appointments, leads } from "@/data/mock";
import { useProperties } from "@/data/propertiesApi";
import { cn } from "@/lib/utils";

import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/appointments")({
  component: AppointmentsPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Citas" error={error} reset={reset} />,
});

function AppointmentsPage() {
  const [month, setMonth] = useState(new Date(2025, 3, 1));
  const { data: properties = [] } = useProperties();

  return (
    <AppShell title="Citas" subtitle="Agenda y administra las visitas a propiedades">
      <Tabs defaultValue="list">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="list"><List className="h-4 w-4 mr-1.5" />Lista</TabsTrigger>
            <TabsTrigger value="calendar"><CalIcon className="h-4 w-4 mr-1.5" />Calendario</TabsTrigger>
          </TabsList>
          <div className="hidden md:block">
            <NewAppointmentDialog />
          </div>
        </div>

        <TabsContent value="calendar">
          <PageCard
            title={format(month, "MMMM yyyy", { locale: es }).replace(/^./, c => c.toUpperCase())}
            action={
              <div className="flex gap-1">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setMonth(subMonths(month, 1))} aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))} aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            }
          >
            <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
              <div className="min-w-[560px]">
                <CalendarGrid month={month} />
              </div>
            </div>
          </PageCard>
        </TabsContent>

        <TabsContent value="list">
          <PageCard title="Próximas citas">
            <ul className="divide-y divide-border">
              {appointments.map((a) => {
                const lead = leads.find(l => l.id === a.leadId);
                const prop = properties.find(p => p.id === a.propertyId);
                return (
                  <li key={a.id} className="flex items-center gap-3 md:gap-4 py-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                      <div className="text-center leading-tight">
                        <div className="text-[10px] uppercase">{format(parseISO(a.date), "MMM", { locale: es })}</div>
                        <div className="text-base font-semibold">{format(parseISO(a.date), "dd")}</div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{lead?.name} → {prop?.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 truncate"><Clock className="h-3 w-3 shrink-0" />{format(parseISO(a.date), "p", { locale: es })} · {a.notes}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 truncate md:hidden">{prop?.location}</div>
                    </div>
                    <span className="hidden md:inline text-xs text-muted-foreground">{prop?.location}</span>
                  </li>
                );
              })}
            </ul>
          </PageCard>
        </TabsContent>
      </Tabs>

      {/* Mobile FAB */}
      <div className="md:hidden fixed right-4 z-30" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}>
        <NewAppointmentFab />
      </div>
    </AppShell>
  );
}

function NewAppointmentFab() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" className="h-14 w-14 rounded-full shadow-[var(--shadow-elevated)] bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition" aria-label="Nueva cita">
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <NewAppointmentDialogContent onClose={() => setOpen(false)} />
    </Dialog>
  );
}

function CalendarGrid({ month }: { month: Date }) {
  const start = startOfWeek(startOfMonth(month));
  const end = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start, end });
  const today = new Date();
  return (
    <div>
      <div className="grid grid-cols-7 text-xs text-muted-foreground font-medium mb-2">
        {["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(d => <div key={d} className="px-2 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dayApps = appointments.filter(a => isSameDay(parseISO(a.date), d));
          const inMonth = isSameMonth(d, month);
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className={cn("min-h-24 rounded-lg border border-border p-2 text-xs", inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground", isToday && "ring-2 ring-primary/30")}>
              <div className="font-medium mb-1">{format(d, "d")}</div>
              <div className="space-y-1">
                {dayApps.map(a => {
                  const lead = leads.find(l => l.id === a.leadId);
                  return (
                    <div key={a.id} className="rounded bg-primary/10 text-primary px-1.5 py-0.5 truncate">
                      {format(parseISO(a.date), "HH:mm")} · {lead?.name}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewAppointmentDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-1.5"><Plus className="h-4 w-4" /> Nueva Cita</Button></DialogTrigger>
      <NewAppointmentDialogContent onClose={() => setOpen(false)} />
    </Dialog>
  );
}

const phoneRegex = /^\+?[\d\s\-()]{7,20}$/;

const appointmentSchema = z
  .object({
    clientName: z.string().trim().min(2, "Nombre del cliente requerido").max(100, "Máx. 100 caracteres"),
    clientPhone: z
      .string()
      .trim()
      .min(7, "Teléfono requerido")
      .max(20, "Teléfono inválido")
      .regex(phoneRegex, "Teléfono inválido (usa dígitos, espacios, +, -, ())"),
    propertyId: z.string().min(1, "Selecciona una propiedad"),
    date: z.string().min(1, "Fecha requerida").regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    time: z.string().min(1, "Hora requerida").regex(/^\d{2}:\d{2}$/, "Hora inválida"),
    notes: z.string().trim().max(500, "Máx. 500 caracteres").optional().default(""),
  })
  .superRefine((val, ctx) => {
    const dt = new Date(`${val.date}T${val.time}:00`);
    if (Number.isNaN(dt.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "Fecha/hora inválida" });
      return;
    }
    if (dt.getTime() < Date.now() - 60_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["date"], message: "La cita debe ser en el futuro" });
    }
  });

type ApptForm = { clientName: string; clientPhone: string; propertyId: string; date: string; time: string; notes: string };
const emptyAppt: ApptForm = { clientName: "", clientPhone: "", propertyId: "", date: "", time: "", notes: "" };

function NewAppointmentDialogContent({ onClose }: { onClose?: () => void }) {
  const { data: properties = [] } = useProperties();
  const [form, setForm] = useState<ApptForm>(emptyAppt);
  const [errors, setErrors] = useState<Partial<Record<keyof ApptForm, string>>>({});

  function update<K extends keyof ApptForm>(key: K, value: ApptForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = appointmentSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof ApptForm, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ApptForm;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error(parsed.error.issues[0].message);
      return;
    }
    toast.success("Cita agendada");
    setForm(emptyAppt);
    setErrors({});
    onClose?.();
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Crear cita</DialogTitle></DialogHeader>
      <form onSubmit={handleSubmit} noValidate className="grid gap-4">
        <ApptField label="Cliente *" hint="Nombre del cliente que asistirá a la visita" error={errors.clientName}>
          <Input
            value={form.clientName}
            onChange={(e) => update("clientName", e.target.value)}
            placeholder="Ej. Juan Pérez"
            maxLength={100}
            aria-invalid={!!errors.clientName}
          />
        </ApptField>
        <ApptField label="Teléfono (WhatsApp) *" hint="Se usará para enviar recordatorios automáticos por WhatsApp" error={errors.clientPhone}>
          <Input
            type="tel"
            inputMode="tel"
            value={form.clientPhone}
            onChange={(e) => update("clientPhone", e.target.value)}
            placeholder="+52 55 1234 5678"
            maxLength={20}
            aria-invalid={!!errors.clientPhone}
          />
        </ApptField>
        <ApptField label="Propiedad *" hint="Inmueble a mostrar" error={errors.propertyId}>
          <Select value={form.propertyId} onValueChange={(v) => update("propertyId", v)}>
            <SelectTrigger aria-invalid={!!errors.propertyId}><SelectValue placeholder="Selecciona propiedad" /></SelectTrigger>
            <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
          </Select>
        </ApptField>
        <div className="grid grid-cols-2 gap-4">
          <ApptField label="Fecha *" hint="Debe ser hoy o posterior" error={errors.date}>
            <Input type="date" min={todayIso} value={form.date} onChange={(e) => update("date", e.target.value)} aria-invalid={!!errors.date} />
          </ApptField>
          <ApptField label="Hora *" hint="Formato 24 h (HH:MM)" error={errors.time}>
            <Input type="time" value={form.time} onChange={(e) => update("time", e.target.value)} aria-invalid={!!errors.time} />
          </ApptField>
        </div>
        <ApptField label="Notas" hint="Opcional · máx. 500 caracteres" error={errors.notes}>
          <Textarea rows={3} value={form.notes} onChange={(e) => update("notes", e.target.value)} placeholder="Detalles de la visita…" maxLength={500} aria-invalid={!!errors.notes} />
        </ApptField>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onClose?.()}>Cancelar</Button>
          <Button type="submit">Agendar</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ApptField({ label, hint, error, className, children }: { label: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
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
