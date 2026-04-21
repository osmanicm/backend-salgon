import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Building2, CalendarCheck, Users as UsersIcon, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { useAuth } from "@/hooks/useAuth";
import { appointments, leads } from "@/data/mock";
import { useProperties } from "@/data/store";

export const Route = createFileRoute("/agent")({
  component: AgentDashboard,
});

function AgentDashboard() {
  const { user, profile } = useAuth();
  const properties = useProperties();

  const mine = useMemo(() => {
    const myProps = properties.filter((p) => p.agentId === user?.id);
    const myLeads = leads.filter((l) => l.assignedTo === user?.id);
    const myAppts = appointments.filter((a) => a.agentId === user?.id);
    return { myProps, myLeads, myAppts };
  }, [properties, user?.id]);

  const name = profile?.full_name || user?.email?.split("@")[0] || "Agente";

  const kpis = [
    { label: "Mis propiedades", value: String(mine.myProps.length), icon: Building2, to: "/properties" as const },
    { label: "Mis prospectos", value: String(mine.myLeads.length), icon: UsersIcon, to: "/leads" as const },
    { label: "Mis citas", value: String(mine.myAppts.length), icon: CalendarCheck, to: "/appointments" as const },
  ];

  return (
    <AppShell title={`Hola, ${name}`} subtitle="Vista de agente">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} to={k.to}>
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
          <Link to="/properties" className="text-sm text-primary hover:underline">Ver propiedades</Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/leads" className="text-sm text-primary hover:underline">Mis prospectos</Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/appointments" className="text-sm text-primary hover:underline">Agenda</Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/whatsapp" className="text-sm text-primary hover:underline">WhatsApp</Link>
        </div>
      </PageCard>
    </AppShell>
  );
}
