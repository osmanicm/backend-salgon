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
import { appointments, leads, properties } from "@/data/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/appointments")({ component: AppointmentsPage });

function AppointmentsPage() {
  const [month, setMonth] = useState(new Date(2025, 3, 1));

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
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon" className="h-14 w-14 rounded-full shadow-[var(--shadow-elevated)] bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 transition" aria-label="Nueva cita">
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <NewAppointmentDialogContent />
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
  return (
    <Dialog>
      <DialogTrigger asChild><Button className="gap-1.5"><Plus className="h-4 w-4" /> Nueva Cita</Button></DialogTrigger>
      <NewAppointmentDialogContent />
    </Dialog>
  );
}

function NewAppointmentDialogContent() {
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Crear cita</DialogTitle></DialogHeader>
      <div className="grid gap-4">
        <div className="space-y-1.5"><Label>Cliente (Prospecto)</Label>
          <Select><SelectTrigger><SelectValue placeholder="Selecciona prospecto" /></SelectTrigger>
            <SelectContent>{leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Propiedad</Label>
          <Select><SelectTrigger><SelectValue placeholder="Selecciona propiedad" /></SelectTrigger>
            <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Fecha</Label><Input type="date" /></div>
          <div className="space-y-1.5"><Label>Hora</Label><Input type="time" /></div>
        </div>
        <div className="space-y-1.5"><Label>Notas</Label><Textarea rows={3} placeholder="Detalles de la visita…" /></div>
      </div>
      <DialogFooter><Button variant="outline">Cancelar</Button><Button>Agendar</Button></DialogFooter>
    </DialogContent>
  );
}
