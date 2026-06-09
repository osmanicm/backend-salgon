import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, Filter, Users as UsersIcon } from "lucide-react";
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
import { useAllEventRegistrations, useEvents } from "@/data/eventsApi";
import {
  exportRegistrationsCsv,
  exportRegistrationsPdf,
  fmtRegisteredAt,
  type RegistrationExportRow,
} from "@/lib/eventRegistrationsExport";

export const Route = createFileRoute("/events/registrations")({
  beforeLoad: async () => {
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

function nameOf(r: { user?: { full_name: string | null; email: string | null } | null; user_id: string }) {
  return r.user?.full_name || r.user?.email || r.user_id;
}

function EventRegistrationsPage() {
  const navigate = useNavigate();
  const regsQuery = useAllEventRegistrations();
  const { data: events = [] } = useEvents();

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
                  <TableHead>Fecha y hora de registro</TableHead>
                  <TableHead>Evento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{nameOf(r)}</TableCell>
                    <TableCell className="text-muted-foreground">{fmtRegisteredAt(r.created_at)}</TableCell>
                    <TableCell>{r.event?.title ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PageCard>
    </AppShell>
  );
}
