import { Clock, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function PendingActivationScreen() {
  const { signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    toast.success("Sesión cerrada");
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-full grid place-items-center bg-warning/15 text-warning">
          <Clock className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Cuenta pendiente
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Tu cuenta está pendiente de activación</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Confirmaste tu correo correctamente. Un administrador debe activar tu cuenta antes de que
            puedas acceder a la plataforma. Te avisaremos cuando esté lista.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
        </div>
      </div>
    </div>
  );
}
