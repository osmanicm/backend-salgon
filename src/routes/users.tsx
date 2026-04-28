import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Mail, Phone, KeyRound, ShieldCheck, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ResetPasswordDialog } from "@/components/users/ResetPasswordDialog";
import { listManagedUsers, type ManagedUser } from "@/utils/users-admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { getAuthHeaders } from "@/lib/serverFnAuth";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/users")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/agent" });
  },
  component: UsersPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary title="Usuarios" error={error} reset={reset} />
  ),
});

function initials(name: string | null, email: string | null) {
  const base = (name || email || "?").trim();
  return base
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function UsersPage() {
  const navigate = useNavigate();
  const [resetTarget, setResetTarget] = React.useState<ManagedUser | null>(null);

  const usersQuery = useQuery({
    queryKey: ["managed-users"],
    queryFn: async () => {
      const res = await listManagedUsers();
      if (res.error) throw new Error(res.error);
      return res.users;
    },
  });

  const users = usersQuery.data ?? [];

  return (
    <AppShell title="Usuarios" subtitle="Administradores y agentes que gestionan la plataforma">
      <PageCard
        title="Miembros del equipo"
        description={
          usersQuery.isLoading
            ? "Cargando…"
            : `${users.length} usuario${users.length === 1 ? "" : "s"} registrado${users.length === 1 ? "" : "s"}`
        }
        action={
          <Button className="gap-1.5" onClick={() => navigate({ to: "/auth" })}>
            <Plus className="h-4 w-4" /> Invitar usuario
          </Button>
        }
      >
        {usersQuery.isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))}
          </div>
        )}

        {usersQuery.isError && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 text-center">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-destructive" />
            <div className="text-sm font-medium text-destructive">No se pudieron cargar los usuarios</div>
            <div className="text-xs text-muted-foreground mt-1">
              {(usersQuery.error as Error)?.message ?? "Error desconocido"}
            </div>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => usersQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        )}

        {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No hay usuarios registrados todavía.
          </div>
        )}

        {!usersQuery.isLoading && users.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {users.map((u) => {
              const isAdmin = u.roles.includes("admin");
              return (
                <div key={u.id} className="rounded-xl border border-border bg-card p-5 flex flex-col">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.full_name ?? u.email ?? ""} />}
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {initials(u.full_name, u.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{u.full_name || "Sin nombre"}</div>
                        <Badge variant={isAdmin ? "default" : "secondary"} className="shrink-0">
                          {isAdmin ? "Admin" : u.roles.includes("agent") ? "Agente" : "Sin rol"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono truncate" title={u.id}>
                        {u.id.slice(0, 8)}…
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{u.email ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {u.phone ?? "—"}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 pt-4 border-t border-border text-xs">
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider text-[10px]">Último acceso</div>
                      <div className="font-medium mt-0.5">{formatDate(u.last_sign_in_at)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground uppercase tracking-wider text-[10px]">Estado</div>
                      <div className="font-medium mt-0.5 flex items-center gap-1">
                        {u.must_change_password ? (
                          <>
                            <AlertTriangle className="h-3 w-3 text-warning" />
                            <span>Debe cambiar contraseña</span>
                          </>
                        ) : u.email_confirmed_at ? (
                          <>
                            <ShieldCheck className="h-3 w-3 text-success" />
                            <span>Activo</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Pendiente</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5"
                      onClick={() => setResetTarget(u)}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      Reset password
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PageCard>

      <ResetPasswordDialog
        user={resetTarget}
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        onSuccess={() => {
          usersQuery.refetch();
          toast.message("Recuerda compartir la contraseña por un canal seguro.");
        }}
      />
    </AppShell>
  );
}
