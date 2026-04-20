import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Home, BadgeDollarSign, Users as UsersIcon,
  CalendarCheck, CheckCircle2, ArrowRight, Phone, MapPin,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { appointments, leads, fmtMXN } from "@/data/mock";
import { useAvailability, useProperties } from "@/data/store";

export const Route = createFileRoute("/")({ component: DashboardPage });

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function DashboardPage() {
  const availability = useAvailability();
  const properties = useProperties();

  const stats = useMemo(() => {
    const now = new Date();
    const disponibles = availability.filter((r) => r.status === "Available").length;
    const vendidasMes = availability.filter(
      (r) => r.status === "Sold" && isSameMonth(new Date(r.updatedAt), now),
    ).length;
    const prospectosActivos = leads.filter((l) => l.status !== "Closed").length;
    const citasHoy = appointments.filter((a) => isSameDay(new Date(a.date), now));
    const ventasCerradas = availability.filter((r) => r.status === "Sold");
    return { disponibles, vendidasMes, prospectosActivos, citasHoy, ventasCerradas };
  }, [availability]);

  const kpis = [
    { label: "Propiedades disponibles", value: String(stats.disponibles), icon: Home, tint: "text-success bg-success/10", to: "/availability" as const },
    { label: "Vendidas este mes", value: String(stats.vendidasMes), icon: BadgeDollarSign, tint: "text-gold-foreground bg-gold/20", to: "/availability" as const },
    { label: "Prospectos activos", value: String(stats.prospectosActivos), icon: UsersIcon, tint: "text-info bg-info/10", to: "/leads" as const },
    { label: "Citas hoy", value: String(stats.citasHoy.length), icon: CalendarCheck, tint: "text-primary bg-primary/10", to: "/appointments" as const },
    { label: "Ventas cerradas", value: String(stats.ventasCerradas.length), icon: CheckCircle2, tint: "text-success bg-success/10", to: "/pipeline" as const },
  ];

  const propsById = useMemo(() => Object.fromEntries(properties.map((p) => [p.id, p])), [properties]);
  const leadsById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), []);

  const todayAppointments = stats.citasHoy
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const recentSales = stats.ventasCerradas
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5);

  return (
    <AppShell title="Panel de Control" subtitle="Resumen operativo de Salgon Bienes Raíces">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link
              key={k.label}
              to={k.to}
              className="rounded-2xl border border-border bg-card p-3.5 md:p-4 shadow-[var(--shadow-card)] hover:border-primary/40 transition-colors"
            >
              <div className={`h-9 w-9 rounded-lg grid place-items-center ${k.tint}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight">{k.value}</div>
              <div className="text-[11px] md:text-xs text-muted-foreground mt-0.5 leading-tight">{k.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Citas hoy */}
        <PageCard
          className="min-w-0"
          title="Citas de hoy"
          description={todayAppointments.length === 0 ? "Sin citas programadas" : `${todayAppointments.length} cita(s) programada(s)`}
          action={
            <Link to="/appointments" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {todayAppointments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No hay citas para hoy.</div>
          ) : (
            <ul className="divide-y divide-border">
              {todayAppointments.map((a) => {
                const lead = leadsById[a.leadId];
                const prop = propsById[a.propertyId];
                const time = new Date(a.date).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                return (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <div className="h-10 w-12 rounded-lg bg-primary/10 text-primary grid place-items-center text-sm font-semibold tabular-nums">
                      {time}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{lead?.name ?? a.leadId}</p>
                      <p className="text-xs text-muted-foreground truncate">{prop?.title ?? a.propertyId}</p>
                    </div>
                    {lead?.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        className="h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:text-primary hover:bg-accent"
                        aria-label="Llamar"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </PageCard>

        {/* Ventas recientes */}
        <PageCard
          className="min-w-0"
          title="Ventas cerradas recientes"
          description="Últimas unidades vendidas"
          action={
            <Link to="/availability" className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
              Ver inventario <ArrowRight className="h-3 w-3" />
            </Link>
          }
        >
          {recentSales.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Aún no hay ventas registradas.</div>
          ) : (
            <ul className="divide-y divide-border">
              {recentSales.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-3">
                  <div className="h-9 w-9 rounded-lg bg-gold/20 text-gold-foreground grid place-items-center">
                    <BadgeDollarSign className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {r.model} · Lote {r.lot}
                    </p>
                    <p className="text-xs text-muted-foreground truncate inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {r.cluster}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold tabular-nums">{fmtMXN(r.price)}</div>
                    <div className="mt-0.5"><StatusBadge status={r.status} /></div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PageCard>
      </div>
    </AppShell>
  );
}
