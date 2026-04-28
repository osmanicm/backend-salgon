import { Bell, Search, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export function MobileHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Usuario";
  const initials = displayName
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleSignOut() {
    await signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/auth" });
  }

  return (
    <header
      className="md:hidden sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border"
      style={{ paddingTop: "max(env(safe-area-inset-top), 0px)" }}
    >
      <div className="flex items-center gap-3 px-4 h-14">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <button
          className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted active:scale-95 transition"
          aria-label="Buscar"
        >
          <Search className="h-4.5 w-4.5" />
        </button>
        <button
          className="relative h-9 w-9 grid place-items-center rounded-full hover:bg-muted active:scale-95 transition"
          aria-label="Notificaciones"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-gold" />
        </button>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-[11px]">
            {initials}
          </AvatarFallback>
        </Avatar>
        <button
          onClick={handleSignOut}
          className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted active:scale-95 transition text-muted-foreground"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <LogOut className="h-4.5 w-4.5" />
        </button>
      </div>
    </header>
  );
}
