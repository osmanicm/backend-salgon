import * as React from "react";
import { Copy, RefreshCw, Eye, EyeOff, Loader2, KeyRound, Check, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { adminResetUserPassword } from "@/utils/users-admin.functions";
import { getAuthHeaders } from "@/lib/serverFnAuth";

interface Props {
  user: { id: string; email: string | null; full_name: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// 16-char temporary password using a charset that avoids ambiguous glyphs.
function generateTempPassword(length = 16): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%*?";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) out += charset[arr[i] % charset.length];
  // Guarantee at least one of each class
  const ensure = (re: RegExp, fallback: string) => {
    if (!re.test(out)) {
      const idx = Math.floor(Math.random() * out.length);
      out = out.substring(0, idx) + fallback + out.substring(idx + 1);
    }
  };
  ensure(/[A-Z]/, "Q");
  ensure(/[a-z]/, "k");
  ensure(/[0-9]/, "7");
  ensure(/[!@#$%*?]/, "!");
  return out;
}

export function ResetPasswordDialog({ user, open, onOpenChange, onSuccess }: Props) {
  const [password, setPassword] = React.useState(() => generateTempPassword());
  const [show, setShow] = React.useState(true);
  const [forceChange, setForceChange] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState<{ password: string; email: string | null } | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Regenerate password every time the dialog opens.
  React.useEffect(() => {
    if (open) {
      setPassword(generateTempPassword());
      setShow(true);
      setForceChange(true);
      setDone(null);
      setCopied(false);
    }
  }, [open]);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Contraseña copiada al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar. Cópiala manualmente.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      const res = await adminResetUserPassword({
        data: {
          user_id: user.id,
          new_password: password,
          force_change_on_next_login: forceChange,
        },
      });
      if (!res.ok) {
        toast.error(res.error ?? "No se pudo restablecer la contraseña");
        return;
      }
      setDone({ password, email: res.email });
      toast.success("Contraseña restablecida correctamente");
      onSuccess?.();
    } catch (err) {
      console.error(err);
      toast.error("Error al restablecer la contraseña");
    } finally {
      setSubmitting(false);
    }
  }

  const displayName = user?.full_name || user?.email || "este usuario";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Restablecer contraseña
          </DialogTitle>
          <DialogDescription>
            {done
              ? `Se asignó una nueva contraseña a ${displayName}. Compártela por un canal seguro.`
              : `Asigna una contraseña temporal para ${displayName}.`}
          </DialogDescription>
        </DialogHeader>

        {!done ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="temp-password">Contraseña temporal</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="temp-password"
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-9 font-mono text-sm"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={72}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={show ? "Ocultar" : "Mostrar"}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPassword(generateTempPassword())}
                  title="Generar nueva"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(password)}
                  title="Copiar"
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres. Por defecto se genera una segura de 16.
              </p>
            </div>

            <label className="flex items-start gap-2 cursor-pointer rounded-md border border-border p-3 hover:bg-muted/40">
              <Checkbox
                checked={forceChange}
                onCheckedChange={(v) => setForceChange(Boolean(v))}
                className="mt-0.5"
              />
              <div className="text-sm">
                <div className="font-medium">Obligar al usuario a cambiarla en el próximo inicio de sesión</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Recomendado. Tras iniciar sesión con la contraseña temporal, será redirigido para crear una nueva.
                </div>
              </div>
            </label>

            <div
              role="status"
              className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs"
              style={{
                borderColor: "color-mix(in oklab, var(--warning, #d97706) 40%, transparent)",
                background: "color-mix(in oklab, var(--warning, #d97706) 10%, transparent)",
              }}
            >
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
              <div>
                Esta acción cierra cualquier sesión activa del usuario y reemplaza su contraseña inmediatamente.
                Compártela únicamente por un canal seguro.
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Restablecer contraseña
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Contraseña temporal asignada</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={done.password}
                  className="font-mono text-sm"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(done.password)}
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              {done.email && (
                <p className="text-xs text-muted-foreground">
                  Compártela con <span className="font-medium text-foreground">{done.email}</span> por un canal seguro
                  (no por email sin cifrar).
                </p>
              )}
            </div>

            {forceChange && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                El usuario será redirigido automáticamente a la pantalla de cambio de contraseña en su próximo inicio de
                sesión.
              </div>
            )}

            <DialogFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
