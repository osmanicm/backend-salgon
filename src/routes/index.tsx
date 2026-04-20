import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Building2, CheckCircle2, BadgeDollarSign, Users as UsersIcon,
  TrendingUp, Receipt, ArrowUpRight, ArrowDownRight, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Legend,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { activity, monthlyStats, propertiesByStatus } from "@/data/mock";

export const Route = createFileRoute("/")({ component: DashboardPage });

const kpis = [
  { label: "Propiedades Totales", value: "248", delta: "+4.2%", up: true, icon: Building2, tint: "text-primary bg-primary/10" },
  { label: "Propiedades Activas", value: "187", delta: "+1.8%", up: true, icon: CheckCircle2, tint: "text-success bg-success/10" },
  { label: "Propiedades Vendidas", value: "42", delta: "+12%", up: true, icon: BadgeDollarSign, tint: "text-gold-foreground bg-gold/20" },
  { label: "Prospectos Totales", value: "1,284", delta: "+8.4%", up: true, icon: UsersIcon, tint: "text-info bg-info/10" },
  { label: "Tasa de Conversión", value: "16.2%", delta: "-0.6%", up: false, icon: TrendingUp, tint: "text-warning-foreground bg-warning/15" },
  { label: "Ventas del Mes", value: "$3.42M MXN", delta: "+22%", up: true, icon: Receipt, tint: "text-primary bg-primary/10" },
];

const STATUS_ES: Record<string, string> = {
  Available: "Disponible",
  Reserved: "Apartado",
  Sold: "Vendido",
};

const ACTIVITY_TYPE_ES: Record<string, string> = {
  lead: "Prospecto",
  property: "Propiedad",
  appointment: "Cita",
  sale: "Venta",
};

function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const chartData = propertiesByStatus.map((p) => ({ ...p, status: STATUS_ES[p.status] ?? p.status }));
  return (
    <AppShell title="Panel de Control" subtitle="Vista general de tus operaciones inmobiliarias">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl border border-border bg-card p-3.5 md:p-4 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between">
                <div className={`h-9 w-9 rounded-lg grid place-items-center ${k.tint}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={`inline-flex items-center text-[11px] font-medium ${k.up ? "text-success" : "text-destructive"}`}>
                  {k.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {k.delta}
                </span>
              </div>
              <div className="mt-3 text-xl md:text-2xl font-semibold tracking-tight">{k.value}</div>
              <div className="text-[11px] md:text-xs text-muted-foreground mt-0.5 leading-tight">{k.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PageCard className="lg:col-span-2 min-w-0" title="Prospectos vs Ventas" description="Desempeño de los últimos 6 meses">
          <div style={{ width: "100%", height: 288 }}>
            {mounted && (
              <ResponsiveContainer>
                <LineChart data={monthlyStats} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === "leads" ? "Prospectos" : "Ventas"} />
                  <Line type="monotone" dataKey="leads" name="Prospectos" stroke="#1f4d3a" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="sales" name="Ventas" stroke="#d4a437" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </PageCard>

        <PageCard className="min-w-0" title="Propiedades por Estatus" description="Distribución actual del inventario">
          <div style={{ width: "100%", height: 288 }}>
            {mounted && (
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="status" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb" }} formatter={(v) => [v, "Unidades"]} />
                  <Bar dataKey="count" name="Unidades" fill="#1f4d3a" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </PageCard>
      </div>

      <PageCard title="Actividad Reciente" description="Últimos eventos en la plataforma">
        <ul className="divide-y divide-border">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-3">
              <div className="h-8 w-8 rounded-full bg-accent grid place-items-center text-accent-foreground">
                <Activity className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{a.message}</p>
                <p className="text-xs text-muted-foreground">{a.time}</p>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{ACTIVITY_TYPE_ES[a.type] ?? a.type}</span>
            </li>
          ))}
        </ul>
      </PageCard>
    </AppShell>
  );
}
