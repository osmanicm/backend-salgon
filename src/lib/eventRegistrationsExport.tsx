import { downloadCsv } from "@/lib/csv";

/** Fila de inscrito lista para exportar. Fechas en ISO. */
export interface RegistrationExportRow {
  fullName: string;
  registeredAt: string;
  eventTitle: string;
  /** Estatus crudo de la inscripción; se traduce al exportar. */
  status: string;
  /** Hora de entrada, o null si no ha llegado. */
  checkedInAt: string | null;
}

/** Etiquetas en español del estatus, compartidas por la tabla y las exportaciones. */
export const REGISTRATION_STATUS_LABEL: Record<string, string> = {
  Pending: "Pendiente",
  Confirmed: "Aprobado",
  Attended: "Asistió",
  Cancelled: "Rechazado",
};

/** Día y hora legible (es-MX) para CSV/PDF. */
export function fmtRegisteredAt(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Hora de entrada; guion cuando la persona no llegó. */
export function fmtCheckedIn(iso: string | null): string {
  return iso ? fmtRegisteredAt(iso) : "—";
}

export function exportRegistrationsCsv(rows: RegistrationExportRow[], filenameTag: string) {
  const header = ["Nombre completo", "Fecha y hora de registro", "Evento", "Estatus", "Entrada"];
  const body = rows.map((r) => [
    r.fullName,
    fmtRegisteredAt(r.registeredAt),
    r.eventTitle,
    REGISTRATION_STATUS_LABEL[r.status] ?? r.status,
    fmtCheckedIn(r.checkedInAt),
  ]);
  downloadCsv([header, ...body], `inscritos-${filenameTag}.csv`);
}

export async function exportRegistrationsPdf(
  rows: RegistrationExportRow[],
  meta: { title: string; subtitle?: string; filenameTag: string },
) {
  const [{ pdf }, { EventRegistrationsPdfDoc }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/events/EventRegistrationsPdfDoc"),
  ]);
  const dateLabel = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const pdfRows = rows.map((r) => ({
    fullName: r.fullName,
    registeredAt: fmtRegisteredAt(r.registeredAt),
    eventTitle: r.eventTitle,
    status: REGISTRATION_STATUS_LABEL[r.status] ?? r.status,
    checkedIn: fmtCheckedIn(r.checkedInAt),
  }));
  const blob = await pdf(
    <EventRegistrationsPdfDoc
      rows={pdfRows}
      title={meta.title}
      subtitle={meta.subtitle}
      dateLabel={dateLabel}
      attended={rows.filter((r) => !!r.checkedInAt).length}
    />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inscritos-${meta.filenameTag}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
