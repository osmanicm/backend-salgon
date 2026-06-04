import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarCheck, ArrowRight, ShieldAlert, X } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { useAuth } from "@/hooks/useAuth";
import { appointments } from "@/data/mock";
import { useProperties } from "@/data/propertiesApi";
import {
  type BlockedAttempt,
  clearBlockedAttempt,
  labelForAdminPath,
  readBlockedAttempt,
} from "@/lib/blockedAttempt";

import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/agent")({
  component: AgentDashboard,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Mi panel" error={error} reset={reset} />,
});

function AgentDashboard() {
  const { user, profile } = useAuth();
  const { data: properties = [] } = useProperties();
  const [blocked, setBlocked] = useState<BlockedAttempt | null>(null);

  // Read once on mount; don't auto-clear so a hard refresh keeps the hint
  // until the user dismisses it explicitly.
  useEffect(() => {
    setBlocked(readBlockedAttempt());
  }, []);

  function dismissBlocked() {
    clearBlockedAttempt();
    setBlocked(null);
  }

  const mine = useMemo(() => {
    // Mirror what the agent actually sees in /properties (RLS-filtered list).
    return { myProps: properties, myAppts: appointments };
  }, [properties]);

  const name = profile?.full_name || user?.email?.split("@")[0] || "Agente";

  const kpis = [
    { label: "Propiedades", value: String(mine.myProps.length), icon: Building2, to: "/properties" as const },
    { label: "Mis citas", value: String(mine.myAppts.length), icon: CalendarCheck, to: "/appointments" as const },
  ];

  return (
    <AppShell title={`Hola, ${name}`} subtitle="Vista de agente">
      {blocked && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm"
        >
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-foreground">
              No pudiste entrar a {labelForAdminPath(blocked.path)}
            </div>
            <div className="text-xs text-muted-foreground">
              Esa sección está reservada para administradores. Si crees que necesitas acceso,
              pide a un admin que te promueva.
            </div>
          </div>
          <button
            type="button"
            onClick={dismissBlocked}
            aria-label="Descartar aviso"
            className="h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} to={k.to} search={{ q: "" }}>
              <PageCard>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 grid place-items-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">{k.label}</div>
                    <div className="text-2xl font-semibold tracking-tight">{k.value}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </PageCard>
            </Link>
          );
        })}
      </div>

      <PageCard title="Acciones rápidas">
        <div className="flex flex-wrap gap-2">
          <Link to="/properties" search={{ q: "" }} className="text-sm text-primary hover:underline">Ver propiedades</Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/appointments" search={{ q: "" }} className="text-sm text-primary hover:underline">Agenda</Link>
        </div>
      </PageCard>
    </AppShell>
  );
}
