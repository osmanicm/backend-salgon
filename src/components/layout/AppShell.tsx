import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Routes that only admins should access. Agents land on /agent instead.
const ADMIN_ONLY_PATHS = ["/users"];

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const { user, loading, roles } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    const isAdmin = roles.includes("admin");
    // Admin trying to view the agent landing → send to dashboard.
    if (isAdmin && pathname === "/agent") {
      navigate({ to: "/" });
      return;
    }
    // Non-admin hitting an admin-only path → send to agent view.
    if (!isAdmin && ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      navigate({ to: "/agent" });
    }
  }, [loading, user, roles, pathname, navigate]);

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
