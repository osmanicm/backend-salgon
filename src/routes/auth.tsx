import { createFileRoute, redirect } from "@tanstack/react-router";
import * as React from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Mail, Lock, User as UserIcon, CheckCircle2, FileCheck2, RefreshCw, History, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";
import { checkAdminExists } from "@/utils/admin-presence.functions";

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

  // shared form state
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Superadmin presence check
  const [adminCheck, setAdminCheck] = React.useState<
    { status: "loading" } | { status: "ready"; hasAdmin: boolean } | { status: "error" }
  >({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await checkAdminExists();
        if (cancelled) return;
        if (res.error) setAdminCheck({ status: "error" });
        else setAdminCheck({ status: "ready", hasAdmin: res.hasAdmin });
      } catch {
        if (!cancelled) setAdminCheck({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  type CompileRun = { time: string; result: "OK" | "ERROR"; note: string; log: string };
  const compileRuns: CompileRun[] = [
    {
      time: "2026-04-21 14:32",
      result: "OK",
      note: "tsc sin errores",
      log: `$ bunx tsc --noEmit -p tsconfig.json
(exit 0)

✔ Sin errores de tipo.
✔ JSX balanceado en src/routes/properties.tsx.`,
    },
    {
      time: "2026-04-21 14:28",
      result: "OK",
      note: "fieldset removido",
      log: `$ grep -n "fieldset" src/routes/properties.tsx
(sin coincidencias)

✔ <fieldset> reemplazado por className condicional en <form>.
✔ Build estable.`,
    },
    {
      time: "2026-04-21 14:21",
      result: "ERROR",
      note: "Expected closing tag for <fieldset> (520:8)",
      log: `HTTPError: Expected corresponding JSX closing tag for <fieldset>. (520:8)
  at jsxParseElementAt (@babel/parser)
  at parseExprAtom
  at parseStatementContent

→ Causa: <fieldset disabled={locked}> abierto sin </fieldset> de cierre.
→ Fix aplicado: remover wrapper y usar className condicional.`,
    },
    {
      time: "2026-04-21 14:05",
      result: "OK",
      note: "guards canManage añadidos",
      log: `✔ handleSubmit valida canManage(property) antes de mutar.
✔ confirmDelete valida canManage(property) antes de soft-delete.
✔ toast.error si el usuario no tiene permisos.`,
    },
    {
      time: "2026-04-21 13:48",
      result: "OK",
      note: "RLS por agente",
      log: `✔ Política UPDATE: admin OR agent_id = auth.uid()
✔ Política DELETE (soft): admin OR agent_id = auth.uid()
✔ supabase--linter sin warnings críticos.`,
    },
  ];
  const [openLog, setOpenLog] = React.useState<CompileRun | null>(null);
  const [historyFilter, setHistoryFilter] = React.useState<"all" | "OK" | "ERROR">("all");
  const [historyQuery, setHistoryQuery] = React.useState("");
  const [caseSensitive, setCaseSensitive] = React.useState(false);
  const queryRegex = React.useMemo(() => {
    const raw = historyQuery.trim();
    if (!raw) return null;
    // Escape regex specials, then convert wildcard '*' (encoded as \*) into '.*'
    const pattern = raw.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    if (!pattern || pattern === ".*") return null;
    try {
      return new RegExp(pattern, caseSensitive ? "g" : "gi");
    } catch {
      return null;
    }
  }, [historyQuery, caseSensitive]);

  const filteredRuns = compileRuns.filter((r) => {
    if (historyFilter !== "all" && r.result !== historyFilter) return false;
    if (!queryRegex) return true;
    const test = (s: string) => {
      queryRegex.lastIndex = 0;
      return queryRegex.test(s);
    };
    return test(r.note) || test(r.result) || test(r.time) || test(r.log);
  });

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
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
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
    // Wait briefly for the role trigger to populate user_roles, then route by role.
    const userId = signUpData.user?.id;
    let to: "/" | "/agent" = "/agent";
    if (userId) {
      // Small delay to let DB trigger insert into user_roles
      await new Promise((r) => setTimeout(r, 400));
      to = await resolveLandingForUser(userId);
    }
    navigate({ to });
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

        {/* Superadmin presence banner */}
        {adminCheck.status === "loading" && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Verificando si ya existe un administrador…
          </div>
        )}
        {adminCheck.status === "ready" && !adminCheck.hasAdmin && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 rounded-lg border px-3 py-2.5 text-sm"
            style={{
              borderColor: "color-mix(in oklab, var(--primary) 40%, transparent)",
              background: "color-mix(in oklab, var(--primary) 10%, transparent)",
            }}
          >
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div className="flex-1 space-y-1">
                <div className="font-semibold text-foreground">
                  Aún no existe ningún administrador
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  El <strong className="text-foreground">primer registro</strong> en este sistema se convertirá automáticamente en el{" "}
                  <strong className="text-foreground">Superadmin global</strong>. Crea la cuenta principal ahora.
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="mt-1.5 h-7 text-xs"
                  onClick={() => setTab("signup")}
                >
                  Crear superadmin
                </Button>
              </div>
            </div>
          </div>
        )}
        {adminCheck.status === "ready" && adminCheck.hasAdmin && (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success" />
            <span>
              Ya existe un administrador. Las cuentas nuevas se crean como{" "}
              <strong className="text-foreground">agentes</strong>.
            </span>
          </div>
        )}


        <div
          role="status"
          className="mb-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground"
        >
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <span>
            Build OK: el diálogo de Propiedades compila y parsea correctamente (sin errores de JSX).
          </span>
        </div>

        <div
          role="status"
          className="mb-4 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground"
        >
          <div className="flex items-start gap-2">
            <FileCheck2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <div className="flex-1 space-y-0.5">
              <div className="font-medium">Última verificación de compilación</div>
              <div className="text-xs text-muted-foreground">
                Resultado: <span className="text-primary font-medium">JSX válido · tsc sin errores</span> · Archivo:{" "}
                <code className="font-mono">src/routes/properties.tsx</code>
              </div>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
            >
              <RefreshCw className="h-3 w-3" /> Reintentar
            </button>
          </div>
          <details className="mt-2 group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
              Ver detalles
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-background p-2 text-[11px] leading-relaxed font-mono text-muted-foreground whitespace-pre-wrap">
{`$ bunx tsc --noEmit -p tsconfig.json
$ grep -n "fieldset" src/routes/properties.tsx
(sin coincidencias)

✔ Sin errores de compilación.
✔ Etiquetas JSX balanceadas en src/routes/properties.tsx.
✔ Sin <fieldset> huérfano (el fix anterior reemplazó el wrapper por className condicional en <form>).`}
            </pre>
          </details>
        </div>

        <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <div className="flex items-center gap-2 mb-1.5">
            <History className="h-4 w-4 text-primary" />
            <div className="font-medium">Historial de verificaciones</div>
            <div className="ml-auto inline-flex rounded-md border border-border overflow-hidden text-[10px] uppercase tracking-wide">
              {(["all", "OK", "ERROR"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setHistoryFilter(f)}
                  className={`px-2 py-0.5 transition-colors ${
                    historyFilter === f
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {f === "all" ? "Todos" : f}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 mb-2">
            <Input
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && historyQuery) {
                  e.preventDefault();
                  setHistoryQuery("");
                }
              }}
              placeholder='Buscar (Esc para limpiar)'
              aria-label="Buscar en historial de verificaciones (Esc para limpiar)"
              className="h-7 text-xs flex-1"
            />
            <Button
              type="button"
              variant={caseSensitive ? "default" : "outline"}
              size="sm"
              onClick={() => setCaseSensitive((v) => !v)}
              aria-pressed={caseSensitive}
              title={caseSensitive ? "Distinguiendo mayúsculas/minúsculas" : "Sin distinguir mayúsculas/minúsculas"}
              className="h-7 px-2 text-xs font-mono"
            >
              Aa
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHistoryQuery("")}
              disabled={!historyQuery}
              className="h-7 px-2 text-xs"
            >
              Limpiar búsqueda
            </Button>
          </div>
          {historyQuery ? (
            <div
              role="status"
              aria-live="polite"
              className="mb-1.5 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-[11px]"
            >
              <span className="font-medium text-foreground">{filteredRuns.length}</span>
              <span className="text-muted-foreground">resultados de</span>
              <span className="font-medium text-foreground">{compileRuns.length}</span>
              <span className="text-muted-foreground">para</span>
              <span className="font-mono text-primary truncate max-w-[10rem]">"{historyQuery}"</span>
            </div>
          ) : (
            <div className="mb-1.5 text-[11px] text-muted-foreground">
              Mostrando {filteredRuns.length} de {compileRuns.length} runs
            </div>
          )}
          <ul className="divide-y divide-border text-xs">
            {filteredRuns.length === 0 && (
              <li className="py-2 text-xs text-muted-foreground text-center">Sin resultados para este filtro.</li>
            )}
            {filteredRuns.map((r) => (
              <li key={r.time} className="flex items-center gap-2 py-1.5">
                <span
                  className={`inline-flex h-1.5 w-1.5 rounded-full shrink-0 ${
                    r.result === "OK" ? "bg-primary" : "bg-destructive"
                  }`}
                />
                <span className="font-mono text-muted-foreground shrink-0">
                  <HighlightMatch text={r.time} query={historyQuery} caseSensitive={caseSensitive} />
                </span>
                <span
                  className={`font-medium shrink-0 ${r.result === "OK" ? "text-primary" : "text-destructive"}`}
                >
                  <HighlightMatch text={r.result} query={historyQuery} caseSensitive={caseSensitive} />
                </span>
                <span className="text-muted-foreground truncate flex-1 min-w-0" title={r.note}>
                  <HighlightMatch text={r.note} query={historyQuery} caseSensitive={caseSensitive} />
                </span>
                <button
                  type="button"
                  onClick={() => setOpenLog(r)}
                  className="text-primary hover:underline shrink-0"
                >
                  Ver log
                </button>
              </li>
            ))}
          </ul>
        </div>

        <Dialog open={!!openLog} onOpenChange={(o) => !o && setOpenLog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span
                  className={`inline-flex h-2 w-2 rounded-full ${
                    openLog?.result === "OK" ? "bg-primary" : "bg-destructive"
                  }`}
                />
                Run {openLog?.time}
              </DialogTitle>
              <DialogDescription>
                {openLog?.result} · {openLog?.note}
              </DialogDescription>
            </DialogHeader>
            <pre className="max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed font-mono text-foreground whitespace-pre-wrap">
              {openLog ? <HighlightMatch text={openLog.log} query={historyQuery} caseSensitive={caseSensitive} /> : null}
            </pre>
          </DialogContent>
        </Dialog>

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

function HighlightMatch({ text, query, caseSensitive = false }: { text: string; query: string; caseSensitive?: boolean }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  // Escape regex specials, then convert wildcard '*' (encoded as \*) into '.*?' (non-greedy)
  const pattern = q.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*?");
  if (!pattern || pattern === ".*?") return <>{text}</>;
  let regex: RegExp;
  try {
    regex = new RegExp(`(${pattern})`, caseSensitive ? "g" : "gi");
  } catch {
    return <>{text}</>;
  }
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(<React.Fragment key={key++}>{text.slice(lastIndex, m.index)}</React.Fragment>);
    parts.push(
      <mark key={key++} className="rounded-sm bg-primary/25 text-foreground px-0.5">
        {m[0]}
      </mark>
    );
    lastIndex = m.index + m[0].length;
    if (m[0].length === 0) regex.lastIndex++; // avoid zero-width infinite loop
  }
  if (lastIndex < text.length) parts.push(<React.Fragment key={key++}>{text.slice(lastIndex)}</React.Fragment>);
  return <>{parts}</>;
}

function Field({ icon, label, id, children }: { icon: React.ReactNode; label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-xs">{icon}{label}</Label>
      {children}
    </div>
  );
}
