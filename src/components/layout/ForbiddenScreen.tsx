import { useLocation, useNavigate } from "@tanstack/react-router";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordBlockedAttempt } from "@/lib/blockedAttempt";

export function ForbiddenScreen({
  message = "No tienes permisos para acceder a esta sección. Solo los administradores pueden verla.",
}: {
  message?: string;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  function handleReturn() {
    recordBlockedAttempt(pathname);
    navigate({ to: "/agent" });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-full grid place-items-center bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Error 403
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Acceso no autorizado</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button onClick={handleReturn}>
            <ArrowLeft className="h-4 w-4" />
            Volver a mi panel
          </Button>
        </div>
      </div>
    </div>
  );
}
