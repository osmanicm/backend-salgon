import { Search, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { NotificationsBell } from "@/components/layout/NotificationsBell";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { profile, user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Usuario";
  const initials = displayName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const roleLabel = roles.includes("admin") ? "Administrador" : roles.includes("agent") ? "Agente" : "Sin rol";

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  async function handleSignOut() {
    await signOut();
    toast.success("Sesión cerrada");
  }

  return (
    <>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4 px-6 h-16">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="relative hidden md:flex items-center h-9 w-72 rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <Search className="mr-2 h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Buscar propiedades, prospectos…</span>
              <kbd className="hidden lg:inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/60 bg-background ml-2">
                ⌘K
              </kbd>
            </button>
            <NotificationsBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 border-l border-border focus:outline-none">
                  <Avatar className="h-8 w-8">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block leading-tight text-left">
                    <div className="text-sm font-medium">{displayName}</div>
                    <div className="text-[11px] text-muted-foreground">{roleLabel}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                  <User className="h-4 w-4 mr-2" /> Mi perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}
