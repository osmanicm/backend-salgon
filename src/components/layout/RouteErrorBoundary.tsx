import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppShell } from "./AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { RoutePendingSkeleton } from "./RoutePendingSkeleton";

export function RouteErrorBoundary({
  title,
  error,
  reset,
}: {
  title: string;
  error: Error;
  reset: () => void;
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  async function handleRetry() {
    setRetrying(true);
    try {
      await router.invalidate();
      reset();
    } finally {
      // Keep skeleton visible briefly to avoid flicker if cache is warm.
      setTimeout(() => setRetrying(false), 250);
    }
  }

  if (retrying) {
    return <RoutePendingSkeleton title={title} />;
  }

  return (
    <AppShell title={title} subtitle="Error">
      <PageCard
        title="No pudimos cargar esta sección"
        description="Ocurrió un error al renderizar la página."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Esto suele pasar tras una actualización si el navegador conserva una versión vieja del código.
            Intenta recargar; si persiste, vuelve al inicio.
          </p>
          <pre className="text-xs bg-muted/50 border border-border rounded-md p-3 overflow-auto max-h-40">
            {error.message}
          </pre>
          <div className="flex gap-2">
            <Button onClick={handleRetry} disabled={retrying} className="gap-1.5">
              {retrying && <Loader2 className="h-4 w-4 animate-spin" />}
              Reintentar
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Recargar página
            </Button>
          </div>
        </div>
      </PageCard>
    </AppShell>
  );
}

