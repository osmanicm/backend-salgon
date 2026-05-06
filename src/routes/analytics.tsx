import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users as UsersIcon,
  Share2,
  FileText,
  ClipboardList,
  CalendarCheck,
  Activity,
  TrendingUp,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { useAuth } from "@/hooks/useAuth";
import { useAgentEvents, type AgentEventRow, type AgentEventType } from "@/data/agentEvents";
import { supabase } from "@/integrations/supabase/client";
import { ForbiddenScreen } from "@/components/layout/ForbiddenScreen";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary title="Analítica" error={error} reset={reset} />
  ),
});

interface AgentProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

function useAgentProfiles() {
  return useQuery({
    queryKey: ["analytics_agent_profiles"],
    queryFn: async (): Promise<AgentProfile[]> => {
      const { data: roleRows, error: rErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rErr) throw rErr;
      const agentIds = (roleRows ?? [])
        .filter((r) => r.role === "agent")
        .map((r) => r.user_id);
      if (agentIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", agentIds);
      if (error) throw error;
      return (data ?? []) as AgentProfile[];
    },
  });
}

const EVENT_LABEL: Record<AgentEventType, string> = {
  session_start: "Sesiones",
  property_share: "Compartidos",
  property_pdf: "PDF propiedad",
  availability_pdf_general: "PDF disp. general",
  availability_pdf_model: "PDF disp. modelo",
  appointment_created: "Citas creadas",
};

interface AgentMetrics {
  agentId: string;
  name: string;
  email: string | null;
  avatar: string | null;
  total: number;
  byType: Record<AgentEventType, number>;
  lastActiveAt: string | null;
}

function emptyByType(): Record<AgentEventType, number> {
  return {
    session_start: 0,
    property_share: 0,
    property_pdf: 0,
    availability_pdf_general: 0,
    availability_pdf_model: 0,
    appointment_created: 0,
  };
}

function aggregate(events: AgentEventRow[], profiles: AgentProfile[]): AgentMetrics[] {
  const map = new Map<string, AgentMetrics>();
  for (const p of profiles) {
    map.set(p.id, {
      agentId: p.id,
      name: p.full_name || (p.email ? p.email.split("@")[0] : "Agente"),
      email: p.email,
      avatar: p.avatar_url,
      total: 0,
      byType: emptyByType(),
      lastActiveAt: null,
    });
  }
  for (const e of events) {
    const m = map.get(e.agent_id);
    if (!m) continue;
    m.total += 1;
    m.byType[e.event_type] = (m.byType[e.event_type] ?? 0) + 1;
    if (!m.lastActiveAt || e.created_at > m.lastActiveAt) m.lastActiveAt = e.created_at;
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AnalyticsPage() {
  const { roles, loading } = useAuth();
  const isAdmin = roles.includes("admin");

  const { data: events = [], isLoading: lE } = useAgentEvents();
  const { data: profiles = [], isLoading: lP } = useAgentProfiles();

  const metrics = useMemo(() => aggregate(events, profiles), [events, profiles]);

  const totals = useMemo(() => {
    const t = emptyByType();
    let total = 0;
    for (const e of events) {
      t[e.event_type] = (t[e.event_type] ?? 0) + 1;
      total += 1;
    }
    return { byType: t, total };
  }, [events]);

  if (loading) return <AppShell title="Analítica de agentes">{null}</AppShell>;
  if (!isAdmin) return <ForbiddenScreen />;

  const isLoading = lE || lP;

  const kpis = [
    { label: "Agentes activos", value: profiles.length, icon: UsersIcon, tint: "text-primary bg-primary/10" },
    { label: "Sesiones", value: totals.byType.session_start, icon: Activity, tint: "text-info bg-info/10" },
    { label: "Compartidos", value: totals.byType.property_share, icon: Share2, tint: "text-emerald-600 bg-emerald-500/10" },
    { label: "PDFs propiedad", value: totals.byType.property_pdf, icon: FileText, tint: "text-amber-600 bg-amber-500/10" },
    { label: "PDFs disponibilidad", value: totals.byType.availability_pdf_general + totals.byType.availability_pdf_model, icon: ClipboardList, tint: "text-violet-600 bg-violet-500/10" },
    { label: "Citas creadas", value: totals.byType.appointment_created, icon: CalendarCheck, tint: "text-rose-600 bg-rose-500/10" },
  ];

  const top = metrics.slice(0, 5);
  const maxTotal = Math.max(1, ...metrics.map((m) => m.total));

  return (
    <AppShell
      title="Analítica de agentes"
      subtitle="Actividad operativa de los usuarios con rol de agente"
    >
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              <div className={`h-9 w-9 rounded-lg grid place-items-center ${k.tint}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
                {isLoading ? "—" : k.value}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                {k.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Top performers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PageCard
          className="lg:col-span-2"
          title="Top agentes por actividad"
          description="Ordenado por número total de eventos registrados"
        >
          {top.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aún no hay actividad registrada.
            </div>
          ) : (
            <ul className="space-y-3">
              {top.map((m, i) => {
                const pct = Math.round((m.total / maxTotal) * 100);
                return (
                  <li key={m.agentId} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-semibold">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{m.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {m.email ?? "—"}
                        </div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">{m.total}</div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </PageCard>

        <PageCard title="Distribución de eventos" description="Total por tipo de acción">
          <ul className="space-y-2.5">
            {(Object.keys(EVENT_LABEL) as AgentEventType[]).map((t) => {
              const v = totals.byType[t];
              const pct = totals.total ? Math.round((v / totals.total) * 100) : 0;
              return (
                <li key={t}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{EVENT_LABEL[t]}</span>
                    <span className="tabular-nums font-medium">{v}</span>
                  </div>
                  <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </PageCard>
      </div>

      {/* Detailed table */}
      <PageCard
        title="Detalle por agente"
        description="Métricas completas de cada agente"
        action={
          <Link
            to="/users"
            className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
          >
            <TrendingUp className="h-3 w-3" /> Ver usuarios
          </Link>
        }
      >
        <div className="overflow-x-auto -mx-4 md:-mx-5 px-4 md:px-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agente</TableHead>
                <TableHead className="text-right">Sesiones</TableHead>
                <TableHead className="text-right">Compartidos</TableHead>
                <TableHead className="text-right">PDF prop.</TableHead>
                <TableHead className="text-right">PDF disp. gen.</TableHead>
                <TableHead className="text-right">PDF disp. modelo</TableHead>
                <TableHead className="text-right">Citas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Última actividad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                    {isLoading ? "Cargando…" : "Sin agentes con actividad."}
                  </TableCell>
                </TableRow>
              ) : (
                metrics.map((m) => (
                  <TableRow key={m.agentId}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-muted grid place-items-center text-[11px] font-semibold text-muted-foreground">
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{m.name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {m.email ?? "—"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{m.byType.session_start}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.byType.property_share}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.byType.property_pdf}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.byType.availability_pdf_general}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.byType.availability_pdf_model}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.byType.appointment_created}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{m.total}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(m.lastActiveAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageCard>

      {/* Recent activity */}
      <PageCard title="Actividad reciente" description="Últimos 25 eventos registrados">
        {events.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Sin eventos.</div>
        ) : (
          <ul className="divide-y divide-border">
            {events.slice(0, 25).map((e) => {
              const agent = profiles.find((p) => p.id === e.agent_id);
              return (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
                    <Activity className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      <span className="font-medium">{agent?.full_name ?? "Agente"}</span>{" "}
                      <span className="text-muted-foreground">— {EVENT_LABEL[e.event_type]}</span>
                      {e.model && <span className="text-muted-foreground"> · {e.model}</span>}
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                    {fmtDate(e.created_at)}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PageCard>
    </AppShell>
  );
}
