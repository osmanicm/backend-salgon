import * as React from "react";
import { useState, useMemo } from "react";
import { Upload, Download, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, X } from "lucide-react";
import { z } from "zod";
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
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { PropertyInsert, PropertyRow } from "@/data/propertiesApi";
import { nextPropertyCode } from "@/data/propertiesApi";

// ==================== Schema ====================
const STATUS_MAP: Record<string, "Available" | "Reserved" | "Sold"> = {
  available: "Available",
  disponible: "Available",
  reserved: "Reserved",
  apartado: "Reserved",
  reservado: "Reserved",
  sold: "Sold",
  vendido: "Sold",
};

const rowSchema = z.object({
  title: z.string().trim().min(2, "Título demasiado corto").max(120),
  code: z.string().trim().min(2).max(20).optional().or(z.literal("")),
  price: z.number({ invalid_type_error: "Precio inválido" }).min(0).max(999_999_999),
  location: z.string().trim().min(2).max(200),
  status: z.enum(["Available", "Reserved", "Sold"]),
  bedrooms: z.number().int().min(0).max(50),
  bathrooms: z.number().int().min(0).max(50),
  area: z.number().min(0).max(99_999),
  image_url: z.string().trim().url("URL inválida").max(500).optional().or(z.literal("")),
});

const COLUMNS = [
  "title",
  "code",
  "price",
  "location",
  "status",
  "bedrooms",
  "bathrooms",
  "area",
  "image_url",
] as const;

const TEMPLATE_CSV =
  "title,code,price,location,status,bedrooms,bathrooms,area,image_url\n" +
  "Casa Modelo Aurora,,2500000,Querétaro,Available,3,2,150,\n" +
  "Departamento Vista,,1800000,CDMX,Reserved,2,1,85,\n";

// ==================== CSV Parser (RFC 4180-lite) ====================
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// ==================== Types ====================
type ParsedRow = {
  rowNumber: number;
  raw: Record<string, string>;
  data: PropertyInsert | null;
  errors: string[];
};

// ==================== Component ====================
export function BulkUploadDialog({
  open,
  onOpenChange,
  existing,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: PropertyRow[];
}) {
  const qc = useQueryClient();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const validRows = useMemo(() => parsed.filter((r) => r.errors.length === 0), [parsed]);
  const invalidRows = useMemo(() => parsed.filter((r) => r.errors.length > 0), [parsed]);

  function reset() {
    setFileName(null);
    setParsed([]);
    setProgress(0);
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla-propiedades.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Sólo se permiten archivos .csv");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo excede 2 MB");
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      toast.error("El CSV está vacío o no contiene datos");
      setParsed([]);
      return;
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const missing = COLUMNS.filter(
      (c) => c !== "code" && c !== "image_url" && !header.includes(c)
    );
    if (missing.length > 0) {
      toast.error(`Columnas faltantes: ${missing.join(", ")}`);
      setParsed([]);
      return;
    }

    // Build a running set of codes (existing + generated) to avoid duplicates
    const usedCodes = new Set(existing.map((p) => p.code));
    const runningExisting: PropertyRow[] = [...existing];

    const dataRows = rows.slice(1);
    const out: ParsedRow[] = dataRows.map((cells, idx) => {
      const raw: Record<string, string> = {};
      header.forEach((h, i) => (raw[h] = (cells[i] ?? "").trim()));
      const errors: string[] = [];

      const priceNum = Number(raw.price);
      const bedroomsNum = Number(raw.bedrooms);
      const bathroomsNum = Number(raw.bathrooms);
      const areaNum = Number(raw.area);

      const statusKey = raw.status?.toLowerCase();
      const status = STATUS_MAP[statusKey];
      if (!status) errors.push(`Estatus inválido: "${raw.status}"`);

      const candidate = {
        title: raw.title,
        code: raw.code,
        price: Number.isFinite(priceNum) ? priceNum : NaN,
        location: raw.location,
        status: status ?? "Available",
        bedrooms: Number.isFinite(bedroomsNum) ? bedroomsNum : NaN,
        bathrooms: Number.isFinite(bathroomsNum) ? bathroomsNum : NaN,
        area: Number.isFinite(areaNum) ? areaNum : NaN,
        image_url: raw.image_url ?? "",
      };

      const result = rowSchema.safeParse(candidate);
      if (!result.success) {
        result.error.issues.forEach((i) =>
          errors.push(`${i.path.join(".") || "campo"}: ${i.message}`)
        );
      }

      // Code: generate if blank, else check duplicates
      let finalCode = raw.code;
      if (!finalCode) {
        finalCode = nextPropertyCode(runningExisting);
      } else if (usedCodes.has(finalCode)) {
        errors.push(`Folio duplicado: ${finalCode}`);
      }

      const insert: PropertyInsert | null =
        errors.length === 0 && result.success
          ? {
              title: result.data.title,
              code: finalCode,
              price: result.data.price,
              location: result.data.location,
              status: result.data.status,
              bedrooms: result.data.bedrooms,
              bathrooms: result.data.bathrooms,
              area: result.data.area,
              image_url: result.data.image_url || null,
            }
          : null;

      if (insert) {
        usedCodes.add(insert.code);
        runningExisting.push({ ...insert } as PropertyRow);
      }

      return { rowNumber: idx + 2, raw, data: insert, errors };
    });

    setParsed(out);
  }

  async function importValid() {
    if (validRows.length === 0) return;
    setImporting(true);
    setProgress(0);
    let success = 0;
    let failed = 0;
    const failures: ParsedRow[] = [];

    // Insert in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const batch = validRows.slice(i, i + chunkSize);
      const { error } = await supabase
        .from("properties")
        .insert(batch.map((r) => r.data!));
      if (error) {
        failed += batch.length;
        batch.forEach((r) => failures.push({ ...r, errors: [error.message] }));
      } else {
        success += batch.length;
      }
      setProgress(Math.round(((i + batch.length) / validRows.length) * 100));
    }

    setImporting(false);
    qc.invalidateQueries({ queryKey: ["properties"] });

    if (success > 0) toast.success(`${success} propiedades importadas`);
    if (failed > 0) {
      toast.error(`${failed} fallaron al guardar`);
      setParsed((prev) => [
        ...prev.filter((r) => r.errors.length > 0),
        ...failures,
      ]);
    } else {
      reset();
      onOpenChange(false);
    }
  }

  function downloadErrors() {
    if (invalidRows.length === 0) return;
    const header = ["fila", ...COLUMNS, "errores"].join(",");
    const lines = invalidRows.map((r) => {
      const cells = [
        String(r.rowNumber),
        ...COLUMNS.map((c) => `"${(r.raw[c] ?? "").replace(/"/g, '""')}"`),
        `"${r.errors.join("; ").replace(/"/g, '""')}"`,
      ];
      return cells.join(",");
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "filas-con-errores.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Importar propiedades desde CSV
          </DialogTitle>
          <DialogDescription>
            Sube un archivo .csv con las columnas requeridas. Validaremos cada fila antes de guardar.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: file picker */}
        {parsed.length === 0 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">Selecciona un archivo CSV</p>
              <p className="text-xs text-muted-foreground mb-4">
                Máximo 2 MB. Codificación UTF-8.
              </p>
              <input
                id="csv-input"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <label htmlFor="csv-input" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-1.5" /> Elegir archivo
                  </label>
                </Button>
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-1.5" /> Descargar plantilla
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Columnas requeridas:</p>
              <p>
                <code className="font-mono">title, price, location, status, bedrooms, bathrooms, area</code>
              </p>
              <p className="font-medium text-foreground mt-2">Opcionales:</p>
              <p>
                <code className="font-mono">code</code> (se autogenera si está vacío),{" "}
                <code className="font-mono">image_url</code>
              </p>
              <p className="font-medium text-foreground mt-2">Estatus permitidos:</p>
              <p>Available, Reserved, Sold (también acepta Disponible, Apartado, Vendido)</p>
            </div>
          </div>
        )}

        {/* Step 2: preview */}
        {parsed.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm">
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground ml-2">
                  · {parsed.length} filas
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" /> Cambiar archivo
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-success/5 p-3 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <div className="text-lg font-semibold tabular-nums">{validRows.length}</div>
                  <div className="text-xs text-muted-foreground">Listas para importar</div>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-destructive/5 p-3 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <div>
                  <div className="text-lg font-semibold tabular-nums">{invalidRows.length}</div>
                  <div className="text-xs text-muted-foreground">Con errores</div>
                </div>
              </div>
            </div>

            {invalidRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Filas con errores</p>
                  <Button variant="outline" size="sm" onClick={downloadErrors}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar errores
                  </Button>
                </div>
                <div className="rounded-lg border border-border max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="text-left">
                        <th className="px-2 py-2 font-medium">Fila</th>
                        <th className="px-2 py-2 font-medium">Título</th>
                        <th className="px-2 py-2 font-medium">Errores</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invalidRows.map((r) => (
                        <tr key={r.rowNumber} className="border-t border-border">
                          <td className="px-2 py-2 font-mono text-muted-foreground">{r.rowNumber}</td>
                          <td className="px-2 py-2 truncate max-w-[150px]">
                            {r.raw.title || <span className="italic text-muted-foreground">—</span>}
                          </td>
                          <td className="px-2 py-2 text-destructive">
                            {r.errors.join(" · ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {validRows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Vista previa (primeras 5 filas válidas)</p>
                <div className="rounded-lg border border-border overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr className="text-left">
                        <th className="px-2 py-2 font-medium">Folio</th>
                        <th className="px-2 py-2 font-medium">Título</th>
                        <th className="px-2 py-2 font-medium">Precio</th>
                        <th className="px-2 py-2 font-medium">Ubicación</th>
                        <th className="px-2 py-2 font-medium">Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 5).map((r) => (
                        <tr key={r.rowNumber} className="border-t border-border">
                          <td className="px-2 py-2 font-mono">{r.data!.code}</td>
                          <td className="px-2 py-2">{r.data!.title}</td>
                          <td className="px-2 py-2 tabular-nums">${Number(r.data!.price).toLocaleString()}</td>
                          <td className="px-2 py-2">{r.data!.location}</td>
                          <td className="px-2 py-2">{r.data!.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importing && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Importando…</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          {parsed.length > 0 && (
            <Button onClick={importValid} disabled={validRows.length === 0 || importing}>
              {importing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Importar {validRows.length} {validRows.length === 1 ? "propiedad" : "propiedades"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
