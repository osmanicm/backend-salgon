import { Link, useLocation } from "@tanstack/react-router";
import { Home, Building2, Users, CalendarDays, MoreHorizontal } from "lucide-react";
import { ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

type Tab = {
  to: "/" | "/agent" | "/properties" | "/availability" | "/leads" | "/appointments" | "/whatsapp" | "/more";
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const adminTabs: Tab[] = [
  { to: "/", label: "Inicio", icon: Home, exact: true },
  { to: "/properties", label: "Propiedades", icon: Building2 },
  { to: "/leads", label: "Prospectos", icon: Users },
  { to: "/appointments", label: "Citas", icon: CalendarDays },
  { to: "/more", label: "Más", icon: MoreHorizontal },
];

const agentTabs: Tab[] = [
  { to: "/agent", label: "Inicio", icon: Home, exact: true },
  { to: "/properties", label: "Propiedades", icon: Building2 },
  { to: "/availability", label: "Disponibilidad", icon: ClipboardList },
  { to: "/appointments", label: "Citas", icon: CalendarDays },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { roles } = useAuth();
  const tabs = roles.includes("admin") ? adminTabs : agentTabs;
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0px)" }}
    >
      <ul className="grid grid-cols-5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-9 w-12 grid place-items-center rounded-xl transition-colors",
                    active && "bg-primary/10",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
