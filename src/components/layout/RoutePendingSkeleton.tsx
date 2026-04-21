import { AppShell } from "./AppShell";
import { Skeleton } from "@/components/ui/skeleton";

export function RoutePendingSkeleton({ title = "Cargando…" }: { title?: string }) {
  return (
    <AppShell title={title} subtitle="Cargando contenido">
      <div className="space-y-4" role="status" aria-live="polite" aria-busy="true">
        <span className="sr-only">Cargando…</span>

        {/* Header card skeleton */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
        </div>

        {/* Stats / metrics row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 space-y-2 shadow-[var(--shadow-soft)]"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </div>

        {/* Content list skeleton */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-[var(--shadow-soft)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-11 w-14 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
