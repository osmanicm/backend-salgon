/**
 * Exporta filas a un archivo CSV descargable. Incluye BOM UTF-8 para que
 * Excel reconozca los acentos correctamente.
 */
export function downloadCsv(rows: (string | number)[][], filename: string) {
  const content = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
