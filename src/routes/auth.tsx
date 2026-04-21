import { createFileRoute, redirect } from "@tanstack/react-router";
import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Mail, Lock, User as UserIcon, CheckCircle2, FileCheck2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) throw redirect({ to: "/" });
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

  // shared form state
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Credenciales inválidas" : error.message);
      return;
    }
    toast.success("¡Bienvenido!");
    navigate({ to: "/" });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ email, password, full_name: fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: parsed.data.full_name },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message.includes("already") ? "Este correo ya está registrado" : error.message);
      return;
    }
    toast.success("Cuenta creada. Iniciando sesión…");
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="h-10 w-10 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">S</div>
          <div>
            <div className="font-semibold tracking-tight text-lg">Salgon</div>
            <div className="text-xs text-muted-foreground -mt-0.5">Suite Inmobiliaria</div>
          </div>
        </Link>

        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground"
        >
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>
            Build OK: el diálogo de Propiedades compila y parsea correctamente (sin errores de JSX).
          </span>
        </div>

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
                  <Input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
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
                  <Input id="signup-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                </Field>
                <Button type="submit" className="w-full" disabled={loading}>
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
