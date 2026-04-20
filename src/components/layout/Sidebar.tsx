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
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/properties", label: "Properties", icon: Building2 },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/pipeline", label: "Sales Pipeline", icon: KanbanSquare },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/users", label: "Users", icon: UserCog },
] as const;

export function Sidebar() {
  const { pathname } = useLocation();
  return (
    <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground sticky top-0">
      <div className="flex items-center gap-2 px-6 h-16 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">
          S
        </div>
        <div className="leading-tight">
          <div className="font-semibold tracking-tight">Salgon</div>
          <div className="text-[11px] text-sidebar-foreground/60">Real Estate Suite</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
          Main
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
        <button className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent">
          <Settings className="h-4 w-4" /> Settings
        </button>
        <button className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
