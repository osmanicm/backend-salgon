import { FileDown, Image as ImageIcon, Sparkles, Video as VideoIcon, Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function SrLoading({ label }: { label: string }) {
  return (
    <span className="sr-only" role="status" aria-live="polite" aria-busy="true">
      {label}
    </span>
  );
}

export function FichaPdfTabSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
      <SrLoading label="Cargando ficha PDF…" />
      <div className="flex items-center gap-2">
        <FileDown className="h-4 w-4 text-muted-foreground/50" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-3 w-72 max-w-full" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-9 w-32 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </div>
  );
}

export function GalleryTabSkeleton({
  kind,
  count = 6,
}: {
  kind: "photos" | "renders";
  count?: number;
}) {
  const Icon = kind === "photos" ? ImageIcon : Sparkles;
  const label = kind === "photos" ? "Cargando fotos…" : "Cargando renders…";
  return (
    <div className="space-y-3">
      <SrLoading label={label} />
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground/50" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="aspect-video w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function VideosTabSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <SrLoading label="Cargando videos…" />
      <div className="flex items-center gap-2">
        <VideoIcon className="h-4 w-4 text-muted-foreground/50" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="aspect-video w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function FilesTabSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      <SrLoading label="Cargando archivos…" />
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Download className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
          <Skeleton className="h-3.5 w-3.5 rounded-sm" />
        </div>
      ))}
    </div>
  );
}
