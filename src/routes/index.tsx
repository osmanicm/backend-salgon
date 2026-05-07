import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Home, BadgeDollarSign, CheckCircle2, ArrowRight, MapPin,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { fmtMoney } from "@/data/mock";
import { useAvailabilityUnits } from "@/data/availabilityApi";
import { useProperties } from "@/data/propertiesApi";
import { useHasRole } from "@/hooks/useAuth";
import { Navigate } from "@tanstack/react-router";

import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/")({
  component: DashboardPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Dashboard" error={error} reset={reset} />,
});

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function DashboardPage() {
  const isAdmin = useHasRole("admin");
  const isAgent = useHasRole("agent");

  // Agent has its own dashboard at /agent
  if (isAgent && !isAdmin) {
    return <Navigate to="/agent" />;
  }

  const { data: propertiesData = [] } = useProperties();
  const { data: availability = [] } = useAvailabilityUnits();

  const stats = useMemo(() => {
    const now = new Date();
    const disponibles = propertiesData.filter((p) => p.status === "Available").length;
    const vendidasMes = propertiesData.filter(
      (p) => p.status === "Sold" && isSameMonth(new Date(p.updated_at), now),
    ).length;
    const ventasCerradas = availability.filter((r) => r.status === "Sold");
    return { disponibles, vendidasMes, ventasCerradas };
  }, [availability, propertiesData]);

  const kpis = [
    { label: "Propiedades disponibles", value: String(stats.disponibles), icon: Home, tint: "text-success bg-success/10", to: "/properties" as const },
    { label: "Vendidas este mes", value: String(stats.vendidasMes), icon: BadgeDollarSign, tint: "text-gold-foreground bg-gold/20", to: "/properties" as const },
    { label: "Ventas cerradas (inventario)", value: String(stats.ventasCerradas.length), icon: CheckCircle2, tint: "text-success bg-success/10", to: "/availability" as const },
  ];

  const recentSales = stats.ventasCerradas
    .slice()
    .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))
    .slice(0, 5);

  return (
    <AppShell title="Panel de Control" subtitle="Resumen operativo de Salgon Bienes Raíces">
      {/* KPIs reales (DB) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
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

      {/* Ventas recientes (DB: availability_units) */}
      <PageCard
        className="min-w-0"
        title="Ventas cerradas recientes"
        description="Últimas unidades vendidas del inventario"
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
                  {r.desarrollo && (
                    <p className="text-xs text-muted-foreground truncate inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {r.desarrollo}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums">{fmtMoney(Number(r.price))}</div>
                  <div className="mt-0.5"><StatusBadge status={r.status} /></div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PageCard>

      <p className="text-[11px] text-muted-foreground text-center">
        Los KPIs y listados muestran únicamente datos sincronizados con la base de datos.
        Módulos como Prospectos, Citas y Pipeline aparecerán aquí cuando tengan persistencia.
      </p>
    </AppShell>
  );
}
