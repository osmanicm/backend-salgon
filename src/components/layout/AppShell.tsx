import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
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
