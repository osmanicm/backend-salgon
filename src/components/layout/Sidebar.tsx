import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarDays,
  KanbanSquare,
  MessageCircle,
  UserCog,
  Settings,
  LogOut,
  ClipboardList,
  BarChart3,
  Newspaper,
  Ticket,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const adminNav = [
  { to: "/", label: "Panel de Control", icon: LayoutDashboard },
  { to: "/properties", label: "Propiedades", icon: Building2 },
  { to: "/availability", label: "Disponibilidad", icon: ClipboardList },
  { to: "/leads", label: "Prospectos", icon: Users },
  { to: "/appointments", label: "Citas", icon: CalendarDays },
  { to: "/pipeline", label: "Embudo de Ventas", icon: KanbanSquare },
  { to: "/news", label: "Noticias", icon: Newspaper },
  { to: "/events", label: "Eventos", icon: Ticket },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/analytics", label: "Analítica de agentes", icon: BarChart3 },
  { to: "/users", label: "Usuarios", icon: UserCog },
] as const;

const agentNav = [
  { to: "/agent", label: "Inicio", icon: LayoutDashboard },
  { to: "/properties", label: "Propiedades", icon: Building2 },
  { to: "/availability", label: "Disponibilidad", icon: ClipboardList },
  { to: "/appointments", label: "Citas", icon: CalendarDays },
  { to: "/news", label: "Noticias", icon: Newspaper },
  { to: "/events", label: "Eventos", icon: Ticket },
] as const;

export function Sidebar() {
  const { pathname } = useLocation();
  const { signOut, roles } = useAuth();
  const isAdmin = roles.includes("admin");
  const nav = isAdmin ? adminNav : agentNav;
  async function handleSignOut() {
    await signOut();
    toast.success("Sesión cerrada");
  }
  return (
    <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground sticky top-0">
      <div className="flex items-center gap-2 px-6 h-16 border-b border-sidebar-border">
        <img src="/salgon-logo.png" alt="Salgon" className="h-9 w-9 rounded-lg object-cover" />
        <div className="leading-tight">
          <div className="font-semibold tracking-tight">Salgon</div>
          <div className="text-[11px] text-sidebar-foreground/60">Suite Inmobiliaria</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
          Principal
        </div>
        {nav.map((item) => {
          const active = pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-primary font-medium"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3 space-y-1">
        <Link
          to="/profile"
          className={cn(
            "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
            pathname === "/profile"
              ? "bg-sidebar-accent text-sidebar-primary font-medium"
              : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
          )}
        >
          <User className="h-4 w-4" /> Mi Perfil
        </Link>
        <button className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent">
          <Settings className="h-4 w-4" /> Configuración
        </button>
        <button onClick={handleSignOut} className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
