import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Download, FileSpreadsheet, Filter, Users as UsersIcon, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";
import { useAllEventRegistrations, useEvents, useSetRegistrationStatus } from "@/data/eventsApi";
import {
  exportRegistrationsCsv,
  exportRegistrationsPdf,
  fmtRegisteredAt,
  type RegistrationExportRow,
} from "@/lib/eventRegistrationsExport";

export const Route = createFileRoute("/events/registrations")({
  beforeLoad: async () => {
    // En SSR no hay localStorage, así que getSession() siempre da null y esto
    // expulsaba a /auth al recargar la página con una sesión válida. La guarda
    // corre solo en el navegador; los datos los protege la RLS de todos modos.
    if (typeof window === "undefined") return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) throw redirect({ to: "/agent" });
  },
  component: EventRegistrationsPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary title="Inscritos a eventos" error={error} reset={reset} />
  ),
});

function nameOf(r: {
  user?: { full_name: string | null; email: string | null } | null;
  user_id: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
}) {
  // Los registros que llegan de la página pública no tienen cuenta: van con guest_*.
  return r.user?.full_name || r.user?.email || r.guest_name || r.guest_email || r.user_id || "—";
}

const STATUS_ES: Record<string, { label: string; cls: string }> = {
  Pending: { label: "Pendiente", cls: "bg-amber-50 text-amber-800 ring-1 ring-amber-200" },
  Confirmed: { label: "Aprobado", cls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  Attended: { label: "Asistió", cls: "bg-sky-50 text-sky-700 ring-1 ring-sky-200" },
  Cancelled: { label: "Rechazado", cls: "bg-rose-50 text-rose-700 ring-1 ring-rose-200" },
};

function EventRegistrationsPage() {
  const navigate = useNavigate();
  const regsQuery = useAllEventRegistrations();
  const { data: events = [] } = useEvents();
  const setStatus = useSetRegistrationStatus();

  async function decide(id: string, status: "Confirmed" | "Cancelled") {
    try {
      await setStatus.mutateAsync({ id, status });
      toast.success(status === "Confirmed" ? "Solicitud aprobada" : "Solicitud rechazada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo actualizar la solicitud");
    }
  }

  const [eventId, setEventId] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const all = regsQuery.data ?? [];

  const filtered = useMemo(() => {
    const fromMs = from ? new Date(from + "T00:00:00").getTime() : undefined;
    const toMs = to ? new Date(to + "T23:59:59.999").getTime() : undefined;
    return all.filter((r) => {
      if (eventId !== "all" && r.event_id !== eventId) return false;
      const t = new Date(r.created_at).getTime();
      if (fromMs !== undefined && t < fromMs) return false;
      if (toMs !== undefined && t > toMs) return false;
      return true;
    });
  }, [all, eventId, from, to]);

  const exportRows: RegistrationExportRow[] = useMemo(
    () =>
      filtered.map((r) => ({
        fullName: nameOf(r),
        registeredAt: r.created_at,
        eventTitle: r.event?.title ?? "—",
      })),
    [filtered],
  );

  function filterSummary() {
    const parts: string[] = [];
    const ev = events.find((e) => e.id === eventId);
    parts.push(eventId === "all" ? "Todos los eventos" : `Evento: ${ev?.title ?? eventId}`);
    if (from || to) {
      parts.push(`Periodo: ${from || "inicio"} a ${to || "hoy"}`);
    } else {
      parts.push("Periodo: todo el tiempo");
    }
    return parts.join(" · ");
  }

  function handleCsv() {
    if (exportRows.length === 0) {
      toast.error("No hay inscritos para exportar con esos filtros");
      return;
    }
    exportRegistrationsCsv(exportRows, new Date().toISOString().slice(0, 10));
    toast.success(`${exportRows.length} inscrito(s) exportado(s) a CSV`);
  }

  async function handlePdf() {
    if (exportRows.length === 0) {
      toast.error("No hay inscritos para exportar con esos filtros");
      return;
    }
    try {
      await exportRegistrationsPdf(exportRows, {
        title: "Inscritos a eventos",
        subtitle: filterSummary(),
        filenameTag: new Date().toISOString().slice(0, 10),
      });
      toast.success("PDF generado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el PDF");
    }
  }

  return (
    <AppShell title="Inscritos a eventos" subtitle="Lista consolidada de todos los eventos">
      <PageCard
        title="Inscritos"
        description={
          regsQuery.isLoading
            ? "Cargando…"
            : `${filtered.length} de ${all.length} inscripciones`
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate({ to: "/events" })}>
              <ArrowLeft className="h-3.5 w-3.5" /> Eventos
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleCsv}
              disabled={regsQuery.isLoading || filtered.length === 0}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel (CSV)
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handlePdf}
              disabled={regsQuery.isLoading || filtered.length === 0}
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        }
      >
        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Filter className="h-4 w-4" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Evento</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger className="h-9 w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los eventos</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-[160px]" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-[160px]" />
          </div>
          {(eventId !== "all" || from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEventId("all");
                setFrom("");
                setTo("");
              }}
            >
              Limpiar
            </Button>
          )}
        </div>

        {regsQuery.isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : regsQuery.isError ? (
          <div className="py-12 text-center text-sm text-destructive">
            Error al cargar: {(regsQuery.error as Error).message}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <UsersIcon className="h-8 w-8 opacity-50" />
            No hay inscritos con esos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre completo</TableHead>
                  <TableHead>Origen y contacto</TableHead>
                  <TableHead>Fecha y hora de registro</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Estatus</TableHead>
                  <TableHead className="text-right">Aprobación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const esInvitado = !r.user_id;
                  const st = STATUS_ES[r.status] ?? { label: r.status, cls: "bg-muted text-muted-foreground" };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{nameOf(r)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {esInvitado ? (
                          <>
                            <div className="font-medium text-foreground">Página pública</div>
                            <div>{r.guest_email}</div>
                            {r.guest_phone && <div>{r.guest_phone}</div>}
                          </>
                        ) : (
                          "Usuario de la app"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fmtRegisteredAt(r.created_at)}</TableCell>
                      <TableCell>{r.event?.title ?? "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
                          {st.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {r.status === "Pending" ? (
                          <div className="inline-flex gap-1">
                            <Button
                              size="sm"
                              className="h-7 gap-1 text-xs"
                              disabled={setStatus.isPending}
                              onClick={() => void decide(r.id, "Confirmed")}
                            >
                              <Check className="h-3.5 w-3.5" /> Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1 text-xs text-destructive"
                              disabled={setStatus.isPending}
                              onClick={() => void decide(r.id, "Cancelled")}
                            >
                              <X className="h-3.5 w-3.5" /> Rechazar
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </PageCard>
    </AppShell>
  );
}
