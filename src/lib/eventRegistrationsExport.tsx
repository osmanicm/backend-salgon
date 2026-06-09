import { downloadCsv } from "@/lib/csv";

/** Fila de inscrito lista para exportar. `registeredAt` en ISO. */
export interface RegistrationExportRow {
  fullName: string;
  registeredAt: string;
  eventTitle: string;
}

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

export function exportRegistrationsCsv(rows: RegistrationExportRow[], filenameTag: string) {
  const header = ["Nombre completo", "Fecha y hora de registro", "Evento"];
  const body = rows.map((r) => [r.fullName, fmtRegisteredAt(r.registeredAt), r.eventTitle]);
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
  }));
  const blob = await pdf(
    <EventRegistrationsPdfDoc
      rows={pdfRows}
      title={meta.title}
      subtitle={meta.subtitle}
      dateLabel={dateLabel}
    />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inscritos-${meta.filenameTag}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
