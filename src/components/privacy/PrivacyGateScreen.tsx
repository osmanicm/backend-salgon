import * as React from "react";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useRecordPrivacyAcceptance } from "@/data/privacyApi";
import { PrivacyNoticeContent } from "./PrivacyNoticeContent";
import { toast } from "sonner";

/** Pantalla bloqueante: el usuario debe aceptar el aviso vigente para continuar. */
export function PrivacyGateScreen() {
  const { user, signOut } = useAuth();
  const record = useRecordPrivacyAcceptance();

  async function handleAccept() {
    if (!user) return;
    try {
      await record.mutateAsync(user.id);
      toast.success("Aviso de privacidad aceptado");
    } catch {
      toast.error("No se pudo registrar tu aceptación. Intenta de nuevo.");
    }
  }

  async function handleSignOut() {
    await signOut();
    toast.success("Sesión cerrada");
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Antes de continuar
            </div>
            <h1 className="text-lg font-semibold tracking-tight">
              Lee y acepta nuestro Aviso de Privacidad
            </h1>
          </div>
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <PrivacyNoticeContent />
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" onClick={handleSignOut} disabled={record.isPending}>
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </Button>
          <Button onClick={handleAccept} disabled={record.isPending}>
            {record.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            He leído y acepto
          </Button>
        </div>
      </div>
    </div>
  );
}
