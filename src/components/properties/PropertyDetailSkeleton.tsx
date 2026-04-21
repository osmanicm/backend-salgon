import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/skeleton";

export function PropertyDetailSkeleton() {
  return (
    <AppShell title="Propiedad" subtitle="Cargando ficha…">
      <div
        className="space-y-4"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <span className="sr-only">Cargando ficha de la propiedad…</span>

        {/* Header: back + title + folio */}
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-md bg-muted grid place-items-center shrink-0">
            <ArrowLeft className="h-5 w-5 text-muted-foreground/40" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-28" />
          </div>
        </div>

        {/* Quick actions row (5 buttons) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>

        {/* Cover image */}
        <Skeleton className="h-56 sm:h-72 w-full rounded-xl" />

        {/* Galería + archivos card with tabs */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-[var(--shadow-soft)]">
          <div className="space-y-2">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-3 w-80 max-w-full" />
          </div>

          {/* Tab triggers */}
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24 rounded-md" />
            ))}
          </div>

          {/* Gallery grid placeholder */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video w-full rounded-lg" />
            ))}
          </div>
        </div>

        {/* Detalles card */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-[var(--shadow-soft)]">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
