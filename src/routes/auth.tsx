import { createFileRoute, redirect } from "@tanstack/react-router";
import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Mail, Lock, User as UserIcon, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { recordPrivacyAcceptance } from "@/data/privacyApi";
import { SPLASH_EVENT } from "@/components/layout/SplashScreen";

import { toast } from "sonner";
import { z } from "zod";

// Dominio canónico de producción. En producción el correo de confirmación debe
// llevar siempre al login de app.salgon.com (no al origin desde el que se registró).
const SITE_URL = "https://app.salgon.com";

/** URL de redirección para el correo de confirmación: login en el dominio público. */
function emailConfirmRedirectUrl(): string {
  const base = import.meta.env.PROD ? SITE_URL : window.location.origin;
  return `${base}/auth`;
}

async function resolveLandingForUser(userId: string): Promise<"/" | "/agent"> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = (data ?? []).some((r) => r.role === "admin");
  return isAdmin ? "/" : "/agent";
}

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const meta = (session.user.user_metadata ?? {}) as { must_change_password?: boolean };
      if (meta.must_change_password) {
        throw redirect({ to: "/change-password" });
      }
      const to = await resolveLandingForUser(session.user.id);
      throw redirect({ to });
    }
  },
  component: AuthPage,
});

const loginSchema = z.object({
  email: z.string().trim().email("Correo inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(72),
});

const signupSchema = loginSchema.extend({
  full_name: z.string().trim().min(2, "Nombre demasiado corto").max(100),
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = React.useState<"login" | "signup">("login");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showLoginPwd, setShowLoginPwd] = React.useState(false);
  const [showSignupPwd, setShowSignupPwd] = React.useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = React.useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data: signInData, error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Credenciales inválidas" : error.message);
      return;
    }
    toast.success("¡Bienvenido!");
    // Splash + intro sound only on a real login (see SplashScreen).
    window.dispatchEvent(new Event(SPLASH_EVENT));
    const meta = (signInData.user?.user_metadata ?? {}) as { must_change_password?: boolean };
    if (meta.must_change_password) {
      navigate({ to: "/change-password" });
      return;
    }
    const to = signInData.user ? await resolveLandingForUser(signInData.user.id) : "/";
    navigate({ to });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email, password, full_name: fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!acceptedPrivacy) {
      toast.error("Debes aceptar el Aviso de Privacidad para crear tu cuenta");
      return;
    }
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: emailConfirmRedirectUrl(),
        data: { full_name: parsed.data.full_name },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("already") ? "Este correo ya está registrado" : error.message);
      return;
    }
    toast.success("Cuenta creada. Iniciando sesión…");
    // Splash + intro sound only on a real login (see SplashScreen).
    window.dispatchEvent(new Event(SPLASH_EVENT));
    const userId = signUpData.user?.id;
    let to: "/" | "/agent" = "/agent";
    if (userId) {
      await new Promise((r) => setTimeout(r, 400));
      // Deja constancia de la aceptación del aviso (fecha/hora la asigna el servidor).
      await recordPrivacyAcceptance(userId);
      to = await resolveLandingForUser(userId);
    }
    navigate({ to });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <img src="/salgon-logo.png" alt="Salgon" className="h-10 w-10 rounded-lg object-cover" />
          <div>
            <div className="font-semibold tracking-tight text-lg">Salgon</div>
            <div className="text-xs text-muted-foreground -mt-0.5">Suite Inmobiliaria</div>
          </div>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <Field icon={<Mail className="h-4 w-4" />} label="Correo" id="login-email">
                  <Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@empresa.com" />
                </Field>
                <Field icon={<Lock className="h-4 w-4" />} label="Contraseña" id="login-password">
                  <div className="relative">
                    <Input id="login-password" type={showLoginPwd ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShowLoginPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showLoginPwd ? "Ocultar contraseña" : "Mostrar contraseña"}>
                      {showLoginPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <Field icon={<UserIcon className="h-4 w-4" />} label="Nombre completo" id="signup-name">
                  <Input id="signup-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Layla Haddad" />
                </Field>
                <Field icon={<Mail className="h-4 w-4" />} label="Correo" id="signup-email">
                  <Input id="signup-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@empresa.com" />
                </Field>
                <Field icon={<Lock className="h-4 w-4" />} label="Contraseña" id="signup-password">
                  <div className="relative">
                    <Input id="signup-password" type={showSignupPwd ? "text" : "password"} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="pr-10" />
                    <button type="button" onClick={() => setShowSignupPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1} aria-label={showSignupPwd ? "Ocultar contraseña" : "Mostrar contraseña"}>
                      {showSignupPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <label htmlFor="signup-privacy" className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    id="signup-privacy"
                    checked={acceptedPrivacy}
                    onCheckedChange={(v) => setAcceptedPrivacy(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    He leído y acepto el{" "}
                    <Link to="/aviso-de-privacidad" target="_blank" className="text-primary underline underline-offset-2">
                      Aviso de Privacidad
                    </Link>
                    .
                  </span>
                </label>
                <Button type="submit" className="w-full" disabled={loading || !acceptedPrivacy}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Crear cuenta
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  El primer usuario registrado obtiene rol <strong>admin</strong>. Los siguientes son <strong>agentes</strong>.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, id, children }: { icon: React.ReactNode; label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-xs">{icon}{label}</Label>
      {children}
    </div>
  );
}
