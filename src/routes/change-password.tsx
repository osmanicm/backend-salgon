import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { Loader2, KeyRound, CheckCircle2, ShieldAlert } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { clearMustChangePassword } from "@/utils/users-admin.functions";
import { getAuthHeaders } from "@/lib/serverFnAuth";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/change-password")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
  },
  component: ChangePasswordPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary title="Cambiar contraseña" error={error} reset={reset} />
  ),
});

const schema = z
  .object({
    password: z.string().min(8, "Mínimo 8 caracteres").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contraseñas no coinciden",
    path: ["confirm"],
  });

async function resolveLandingForUser(userId: string): Promise<"/" | "/agent"> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = (data ?? []).some((r) => r.role === "admin");
  return isAdmin ? "/" : "/agent";
}

function ChangePasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [forced, setForced] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setUserId(user?.id ?? null);
      const meta = (user?.user_metadata ?? {}) as { must_change_password?: boolean };
      setForced(Boolean(meta.must_change_password));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }
    if (userId) {
      await clearMustChangePassword({ data: { user_id: userId }, headers: await getAuthHeaders() });
    }
    setLoading(false);
    toast.success("Contraseña actualizada");
    const to = userId ? await resolveLandingForUser(userId) : "/";
    navigate({ to });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <div className="h-10 w-10 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">
            S
          </div>
          <div>
            <div className="font-semibold tracking-tight text-lg">Salgon</div>
            <div className="text-xs text-muted-foreground -mt-0.5">Suite Inmobiliaria</div>
          </div>
        </div>

        {forced && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
            style={{
              borderColor: "color-mix(in oklab, var(--primary) 40%, transparent)",
              background: "color-mix(in oklab, var(--primary) 10%, transparent)",
            }}
          >
            <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <div>
              <div className="font-medium">Cambio obligatorio de contraseña</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Tu contraseña fue restablecida por un administrador. Establece una nueva para continuar.
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Nueva contraseña</h1>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Contraseña</Label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Guardando…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Guardar contraseña
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
