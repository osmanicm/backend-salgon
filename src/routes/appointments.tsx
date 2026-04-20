import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Calendar as CalIcon, List, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from "date-fns";
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
    <AppShell title="Appointments" subtitle="Schedule and manage property visits">
      <Tabs defaultValue="calendar">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="calendar"><CalIcon className="h-4 w-4 mr-1.5" />Calendar</TabsTrigger>
            <TabsTrigger value="list"><List className="h-4 w-4 mr-1.5" />List</TabsTrigger>
          </TabsList>
          <NewAppointmentDialog />
        </div>

        <TabsContent value="calendar">
          <PageCard
            title={format(month, "MMMM yyyy")}
            action={
              <div className="flex gap-1">
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            }
          >
            <CalendarGrid month={month} />
          </PageCard>
        </TabsContent>

        <TabsContent value="list">
          <PageCard title="Upcoming appointments">
            <ul className="divide-y divide-border">
              {appointments.map((a) => {
                const lead = leads.find(l => l.id === a.leadId);
                const prop = properties.find(p => p.id === a.propertyId);
                return (
                  <li key={a.id} className="flex items-center gap-4 py-3">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary grid place-items-center">
                      <div className="text-center leading-tight">
                        <div className="text-[10px] uppercase">{format(parseISO(a.date), "MMM")}</div>
                        <div className="text-base font-semibold">{format(parseISO(a.date), "dd")}</div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{lead?.name} → {prop?.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{format(parseISO(a.date), "p")} · {a.notes}</div>
                    </div>
                    <span className="text-xs text-muted-foreground">{prop?.location}</span>
                  </li>
                );
              })}
            </ul>
          </PageCard>
        </TabsContent>
      </Tabs>
    </AppShell>
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
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => <div key={d} className="px-2 py-1">{d}</div>)}
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
      <DialogTrigger asChild><Button className="gap-1.5"><Plus className="h-4 w-4" /> New Appointment</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create appointment</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5"><Label>Client (Lead)</Label>
            <Select><SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
              <SelectContent>{leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Property</Label>
            <Select><SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
              <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" /></div>
            <div className="space-y-1.5"><Label>Time</Label><Input type="time" /></div>
          </div>
          <div className="space-y-1.5"><Label>Notes</Label><Textarea rows={3} placeholder="Visit details…" /></div>
        </div>
        <DialogFooter><Button variant="outline">Cancel</Button><Button>Schedule</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
