import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardList, KanbanSquare, MessageCircle, UserCog,
  Settings, LogOut, ChevronRight, BarChart3, Newspaper, CalendarDays, Ticket,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { useAuth } from "@/hooks/useAuth";

import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/more")({
  component: MorePage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="Más" error={error} reset={reset} />,
});

type Item = {
  to: "/availability" | "/appointments" | "/pipeline" | "/news" | "/events" | "/whatsapp" | "/analytics" | "/users";
  label: string;
  description: string;
  icon: typeof ClipboardList;
  adminOnly?: boolean;
};
type Section = { title: string; items: Item[] };

const sections: Section[] = [
  {
    title: "Operaciones",
    items: [
      { to: "/availability", label: "Disponibilidad", description: "Inventario centralizado", icon: ClipboardList },
      { to: "/appointments", label: "Citas", description: "Agenda de visitas", icon: CalendarDays },
      { to: "/pipeline",     label: "Embudo de Ventas", description: "Tablero de etapas", icon: KanbanSquare, adminOnly: true },
      { to: "/news",         label: "Noticias", description: "Comunicación interna", icon: Newspaper },
      { to: "/events",       label: "Eventos", description: "Asistencia y logística", icon: Ticket },
      { to: "/whatsapp",     label: "WhatsApp", description: "Plantillas y envíos", icon: MessageCircle, adminOnly: true },
      { to: "/analytics",    label: "Analítica de agentes", description: "Métricas y actividad", icon: BarChart3, adminOnly: true },
    ],
  },
  {
    title: "Equipo",
    items: [
      { to: "/users", label: "Usuarios", description: "Administradores y agentes", icon: UserCog, adminOnly: true },
    ],
  },
];

function MorePage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const visibleSections = sections
    .map((s) => ({ ...s, items: s.items.filter((it) => isAdmin || !it.adminOnly) }))
    .filter((s) => s.items.length > 0);
  return (
    <AppShell title="Más" subtitle="Accesos rápidos y configuración">
      {visibleSections.map((s) => (
        <PageCard key={s.title} title={s.title}>
          <ul className="-mx-1 divide-y divide-border">
            {s.items.map((it) => {
              const Icon = it.icon;
              return (
                <li key={it.to}>
                  <Link
                    to={it.to}
                    className="flex items-center gap-3 px-1 py-3 hover:bg-muted/40 active:bg-muted/60 transition-colors rounded-lg"
                  >
                    <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{it.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{it.description}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </PageCard>
      ))}

      <PageCard title="Cuenta">
        <ul className="-mx-1 divide-y divide-border">
          <li>
            <button className="w-full flex items-center gap-3 px-1 py-3 hover:bg-muted/40 active:bg-muted/60 transition-colors rounded-lg text-left">
              <span className="h-10 w-10 rounded-xl bg-muted text-foreground grid place-items-center">
                <Settings className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">Configuración</div>
                <div className="text-xs text-muted-foreground">Preferencias y notificaciones</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-3 px-1 py-3 hover:bg-muted/40 active:bg-muted/60 transition-colors rounded-lg text-left text-destructive">
              <span className="h-10 w-10 rounded-xl bg-destructive/10 grid place-items-center">
                <LogOut className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">Cerrar sesión</div>
                <div className="text-xs text-muted-foreground">Salir de Salgon Suite</div>
              </div>
            </button>
          </li>
        </ul>
      </PageCard>

      <p className="text-center text-[11px] text-muted-foreground pt-2">
        Salgon Suite · v1.0.0
      </p>
    </AppShell>
  );
}
