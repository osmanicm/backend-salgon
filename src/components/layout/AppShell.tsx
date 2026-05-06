import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";
import { ForbiddenScreen } from "./ForbiddenScreen";
import { useAuth } from "@/hooks/useAuth";
import { useSessionLogger } from "@/data/agentEvents";
import { Loader2 } from "lucide-react";

// Routes that only admins should access. Agents see a 403 screen.
// Agents can only see: /properties, /availability, /appointments (+ /agent home).
const ADMIN_ONLY_PATHS = ["/", "/users", "/pipeline", "/leads", "/whatsapp", "/more", "/analytics"];

function isAdminOnly(pathname: string) {
  return ADMIN_ONLY_PATHS.some((p) =>
    p === "/" ? pathname === "/" : pathname === p || pathname.startsWith(p + "/"),
  );
}

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { user, loading, roles } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAdmin = roles.includes("admin");
  const blocked = !loading && !!user && !isAdmin && isAdminOnly(pathname);
  useSessionLogger(user?.id);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    // Admin landing on the agent view → send to dashboard.
    if (isAdmin && pathname === "/agent") {
      navigate({ to: "/" });
    }
  }, [loading, user, isAdmin, pathname, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Cargando…</span>
        </div>
      </div>
    );
  }

  if (blocked) {
    return <ForbiddenScreen />;
  }

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <MobileHeader title={title} subtitle={subtitle} />
        {/* Desktop topbar */}
        <div className="hidden md:block">
          <Topbar title={title} subtitle={subtitle} />
        </div>
        <main
          className="flex-1 p-4 md:p-6 space-y-4 md:space-y-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
