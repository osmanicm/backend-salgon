import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileSpreadsheet,
  X,
  AlertTriangle,
  ArrowLeft,
  Save,
  FileJson,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type FieldKey =
  | "title"
  | "code"
  | "price"
  | "location"
  | "status"
  | "bedrooms"
  | "bathrooms"
  | "area"
  | "image_url";

const FIELDS: {
  key: FieldKey;
  label: string;
  required: boolean;
  aliases: string[];
}[] = [
  { key: "title", label: "Título", required: true, aliases: ["title", "titulo", "título", "nombre", "name"] },
  { key: "code", label: "Folio", required: false, aliases: ["code", "folio", "codigo", "código", "sku"] },
  { key: "price", label: "Precio", required: true, aliases: ["price", "precio", "monto", "valor"] },
  { key: "location", label: "Ubicación", required: true, aliases: ["location", "ubicacion", "ubicación", "direccion", "dirección", "city", "ciudad"] },
  { key: "status", label: "Estatus", required: true, aliases: ["status", "estatus", "estado"] },
  { key: "bedrooms", label: "Recámaras", required: true, aliases: ["bedrooms", "recamaras", "recámaras", "habitaciones", "rooms", "beds"] },
  { key: "bathrooms", label: "Baños", required: true, aliases: ["bathrooms", "banos", "baños", "baths"] },
  { key: "area", label: "Área (m²)", required: true, aliases: ["area", "área", "m2", "metros", "superficie", "size"] },
  { key: "image_url", label: "URL de imagen", required: false, aliases: ["image_url", "image", "imagen", "foto", "photo", "url"] },
];

const TEMPLATE_CSV =
  "title,code,price,location,status,bedrooms,bathrooms,area,image_url\n" +
  "Casa Modelo Aurora,,2500000,Querétaro,Available,3,2,150,\n" +
  "Departamento Vista,,1800000,CDMX,Reserved,2,1,85,\n";

const NONE_VALUE = "__none__";

// ==================== CSV Parser ====================
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
      } else field += c;
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

// Normalize a header for matching (lowercase, strip accents, non-alnum)
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

type MatchKind = "exact" | "alias" | "fuzzy" | "none";

function suggestMapping(headers: string[]): {
  mapping: Record<FieldKey, string | null>;
  kinds: Record<FieldKey, MatchKind>;
} {
  const mapping = {} as Record<FieldKey, string | null>;
  const kinds = {} as Record<FieldKey, MatchKind>;
  const taken = new Set<string>();

  for (const f of FIELDS) {
    let pick: { header: string; kind: MatchKind } | null = null;

    // 1) exact match on field key
    for (const h of headers) {
      if (taken.has(h)) continue;
      if (normalize(h) === normalize(f.key)) {
        pick = { header: h, kind: "exact" };
        break;
      }
    }
    // 2) alias match
    if (!pick) {
      for (const h of headers) {
        if (taken.has(h)) continue;
        const nh = normalize(h);
        if (f.aliases.some((a) => normalize(a) === nh)) {
          pick = { header: h, kind: "alias" };
          break;
        }
      }
    }
    // 3) fuzzy (substring)
    if (!pick) {
      for (const h of headers) {
        if (taken.has(h)) continue;
        const nh = normalize(h);
        if (
          f.aliases.some((a) => {
            const na = normalize(a);
            return na && (nh.includes(na) || na.includes(nh));
          })
        ) {
          pick = { header: h, kind: "fuzzy" };
          break;
        }
      }
    }

    if (pick) {
      mapping[f.key] = pick.header;
      kinds[f.key] = pick.kind;
      taken.add(pick.header);
    } else {
      mapping[f.key] = null;
      kinds[f.key] = "none";
    }
  }
  return { mapping, kinds };
}

// ==================== Types ====================
type ParsedRow = {
  rowNumber: number;
  raw: Record<string, string>;
  data: PropertyInsert | null;
  errors: string[];
};

type Step = "upload" | "map" | "preview";

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
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string | null>>(
    {} as Record<FieldKey, string | null>
  );
  const [matchKinds, setMatchKinds] = useState<Record<FieldKey, MatchKind>>(
    {} as Record<FieldKey, MatchKind>
  );
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const validRows = useMemo(() => parsed.filter((r) => r.errors.length === 0), [parsed]);
  const invalidRows = useMemo(() => parsed.filter((r) => r.errors.length > 0), [parsed]);

  function reset() {
    setStep("upload");
    setFileName(null);
    setHeaders([]);
    setDataRows([]);
    setMapping({} as Record<FieldKey, string | null>);
    setMatchKinds({} as Record<FieldKey, MatchKind>);
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

  function exportMappingTemplate() {
    const fields: Record<string, string | null> = {};
    FIELDS.forEach((f) => (fields[f.key] = mapping[f.key] ?? null));
    const template = {
      version: 1,
      kind: "salgon.property-csv-mapping",
      exportedAt: new Date().toISOString(),
      sourceFile: fileName ?? null,
      fields,
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mapeo-propiedades.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Plantilla de mapeo exportada");
  }

  async function importMappingTemplate(file: File) {
    if (!file.name.toLowerCase().endsWith(".json")) {
      toast.error("Sólo se permiten archivos .json");
      return;
    }
    try {
      const text = await file.text();
      const parsedJson = JSON.parse(text) as {
        kind?: string;
        fields?: Record<string, string | null>;
      };
      if (parsedJson.kind !== "salgon.property-csv-mapping" || !parsedJson.fields) {
        toast.error("El archivo no es una plantilla de mapeo válida");
        return;
      }
      const next = { ...mapping };
      const nextKinds = { ...matchKinds };
      let applied = 0;
      let missing = 0;
      for (const f of FIELDS) {
        const desired = parsedJson.fields[f.key];
        if (desired && headers.includes(desired)) {
          next[f.key] = desired;
          nextKinds[f.key] = "exact";
          applied++;
        } else if (desired) {
          missing++;
          next[f.key] = null;
          nextKinds[f.key] = "none";
        } else {
          next[f.key] = null;
          nextKinds[f.key] = "none";
        }
      }
      setMapping(next);
      setMatchKinds(nextKinds);
      toast.success(
        `Mapeo aplicado: ${applied} campo(s)` +
          (missing > 0 ? ` · ${missing} no encontrados en este CSV` : "")
      );
    } catch {
      toast.error("No se pudo leer la plantilla JSON");
    }
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
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      toast.error("El CSV está vacío o no contiene datos");
      return;
    }
    const hdr = rows[0].map((h) => h.trim());
    const { mapping: m, kinds } = suggestMapping(hdr);
    setFileName(file.name);
    setHeaders(hdr);
    setDataRows(rows.slice(1));
    setMapping(m);
    setMatchKinds(kinds);
    setStep("map");
  }

  function validateWithMapping() {
    const usedCodes = new Set(existing.map((p) => p.code));
    const runningExisting: PropertyRow[] = [...existing];

    const headerIndex = (h: string | null) => (h ? headers.indexOf(h) : -1);
    const idx: Record<FieldKey, number> = {} as Record<FieldKey, number>;
    FIELDS.forEach((f) => (idx[f.key] = headerIndex(mapping[f.key])));

    const out: ParsedRow[] = dataRows.map((cells, rowIdx) => {
      const raw: Record<string, string> = {};
      FIELDS.forEach((f) => {
        raw[f.key] = idx[f.key] >= 0 ? (cells[idx[f.key]] ?? "").trim() : "";
      });
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

      return { rowNumber: rowIdx + 2, raw, data: insert, errors };
    });

    setParsed(out);
    setStep("preview");
  }

  async function importValid() {
    if (validRows.length === 0) return;
    setImporting(true);
    setProgress(0);
    let success = 0;
    let failed = 0;
    const failures: ParsedRow[] = [];

    const chunkSize = 50;
    for (let i = 0; i < validRows.length; i += chunkSize) {
      const batch = validRows.slice(i, i + chunkSize);
      const { error } = await supabase.from("properties").insert(batch.map((r) => r.data!));
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
      setParsed((prev) => [...prev.filter((r) => r.errors.length > 0), ...failures]);
    } else {
      reset();
      onOpenChange(false);
    }
  }

  function downloadErrors() {
    if (invalidRows.length === 0) return;
    const cols: FieldKey[] = FIELDS.map((f) => f.key);
    const header = ["fila", ...cols, "errores"].join(",");
    const lines = invalidRows.map((r) => {
      const cells = [
        String(r.rowNumber),
        ...cols.map((c) => `"${(r.raw[c] ?? "").replace(/"/g, '""')}"`),
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

  // ==================== Mapping warnings ====================
  const mappingIssues = useMemo(() => {
    const warnings: string[] = [];
    const exactMisses: { field: string; chosen: string }[] = [];
    const missingRequired: string[] = [];
    const unmapped: string[] = [];

    for (const f of FIELDS) {
      const sel = mapping[f.key];
      if (!sel) {
        if (f.required) missingRequired.push(f.label);
      } else if (matchKinds[f.key] !== "exact") {
        exactMisses.push({ field: f.label, chosen: sel });
      }
    }

    const mappedHeaders = new Set(
      Object.values(mapping).filter((v): v is string => !!v)
    );
    for (const h of headers) {
      if (!mappedHeaders.has(h)) unmapped.push(h);
    }

    // Duplicate mapping check
    const headerCount = new Map<string, number>();
    Object.values(mapping).forEach((h) => {
      if (h) headerCount.set(h, (headerCount.get(h) ?? 0) + 1);
    });
    const duplicates = [...headerCount.entries()]
      .filter(([, n]) => n > 1)
      .map(([h]) => h);

    if (exactMisses.length) {
      warnings.push(
        `${exactMisses.length} columna(s) no coinciden exactamente con el nombre esperado.`
      );
    }
    if (unmapped.length) {
      warnings.push(`${unmapped.length} columna(s) del CSV se ignorarán: ${unmapped.join(", ")}.`);
    }
    if (duplicates.length) {
      warnings.push(`Columna(s) asignadas a más de un campo: ${duplicates.join(", ")}.`);
    }

    return { warnings, missingRequired, exactMisses, unmapped, duplicates };
  }, [mapping, matchKinds, headers]);

  const canContinue =
    mappingIssues.missingRequired.length === 0 && mappingIssues.duplicates.length === 0;

  useEffect(() => {
    if (!open) reset();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Importar propiedades desde CSV
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Paso 1 de 3 — Sube el archivo."}
            {step === "map" && "Paso 2 de 3 — Asigna las columnas a los campos."}
            {step === "preview" && "Paso 3 de 3 — Revisa y confirma la importación."}
          </DialogDescription>
        </DialogHeader>

        {/* ===== Step indicator ===== */}
        <div className="flex items-center gap-2 text-xs">
          {(["upload", "map", "preview"] as Step[]).map((s, i) => {
            const active = step === s;
            const done =
              (s === "upload" && step !== "upload") ||
              (s === "map" && step === "preview");
            return (
              <React.Fragment key={s}>
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-full ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <span className="font-mono">{i + 1}</span>
                  <span className="capitalize">
                    {s === "upload" ? "Archivo" : s === "map" ? "Mapeo" : "Vista previa"}
                  </span>
                </div>
                {i < 2 && <div className="h-px flex-1 bg-border" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* ===== Step 1: file picker ===== */}
        {step === "upload" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium mb-1">Selecciona un archivo CSV</p>
              <p className="text-xs text-muted-foreground mb-4">Máximo 2 MB. Codificación UTF-8.</p>
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
              <p className="font-medium text-foreground">Campos requeridos:</p>
              <p>title, price, location, status, bedrooms, bathrooms, area</p>
              <p className="font-medium text-foreground mt-2">Opcionales:</p>
              <p>code (autogenerado si está vacío), image_url</p>
              <p className="font-medium text-foreground mt-2">Estatus permitidos:</p>
              <p>Available, Reserved, Sold (también Disponible, Apartado, Vendido)</p>
            </div>
          </div>
        )}

        {/* ===== Step 2: column mapping ===== */}
        {step === "map" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm">
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground ml-2">
                  · {dataRows.length} filas · {headers.length} columnas
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="h-4 w-4 mr-1" /> Cambiar archivo
              </Button>
            </div>

            {/* Mapping template actions */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="mapping-template-input"
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importMappingTemplate(f);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" size="sm" onClick={exportMappingTemplate}>
                <Save className="h-3.5 w-3.5 mr-1.5" /> Exportar mapeo (JSON)
              </Button>
              <Button variant="outline" size="sm" asChild>
                <label htmlFor="mapping-template-input" className="cursor-pointer">
                  <FileJson className="h-3.5 w-3.5 mr-1.5" /> Cargar mapeo
                </label>
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Reutiliza el mismo mapeo en futuras importaciones.
              </span>
            </div>

            {/* Warnings panel */}
            {(mappingIssues.warnings.length > 0 || mappingIssues.missingRequired.length > 0) && (
              <div className="space-y-2">
                {mappingIssues.missingRequired.length > 0 && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-destructive">Faltan campos requeridos</div>
                      <div className="text-xs text-muted-foreground">
                        Asigna una columna para: {mappingIssues.missingRequired.join(", ")}
                      </div>
                    </div>
                  </div>
                )}
                {mappingIssues.warnings.map((w, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-warning/40 bg-warning/5 p-3 flex gap-2 text-sm"
                    style={{
                      borderColor: "color-mix(in oklab, var(--primary) 30%, transparent)",
                      background: "color-mix(in oklab, var(--primary) 5%, transparent)",
                    }}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                    <div className="text-xs text-foreground">{w}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Mapping table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">Campo de propiedad</th>
                    <th className="px-3 py-2 font-medium">Columna del CSV</th>
                    <th className="px-3 py-2 font-medium w-20">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {FIELDS.map((f) => {
                    const sel = mapping[f.key];
                    const kind = matchKinds[f.key];
                    return (
                      <tr key={f.key} className="border-t border-border">
                        <td className="px-3 py-2">
                          <div className="font-medium">{f.label}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {f.key}
                            {f.required && <span className="text-destructive ml-1">*</span>}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Select
                            value={sel ?? NONE_VALUE}
                            onValueChange={(v) => {
                              const newVal = v === NONE_VALUE ? null : v;
                              setMapping((prev) => ({ ...prev, [f.key]: newVal }));
                              setMatchKinds((prev) => ({
                                ...prev,
                                [f.key]: newVal ? "exact" : "none",
                              }));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="— No asignado —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE_VALUE}>— No asignado —</SelectItem>
                              {headers.map((h) => (
                                <SelectItem key={h} value={h}>
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          {!sel ? (
                            f.required ? (
                              <span className="inline-flex items-center gap-1 text-xs text-destructive">
                                <AlertCircle className="h-3 w-3" /> Falta
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">Opcional</span>
                            )
                          ) : kind === "exact" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-success">
                              <CheckCircle2 className="h-3 w-3" /> Exacto
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-primary">
                              <AlertTriangle className="h-3 w-3" />{" "}
                              {kind === "alias" ? "Alias" : "Aprox."}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Tip: usa los nombres exactos de la plantilla para evitar advertencias.
            </p>
          </div>
        )}

        {/* ===== Step 3: preview ===== */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm">
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground ml-2">· {parsed.length} filas</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep("map")}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Editar mapeo
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
                          <td className="px-2 py-2 text-destructive">{r.errors.join(" · ")}</td>
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
                          <td className="px-2 py-2 tabular-nums">
                            ${Number(r.data!.price).toLocaleString()}
                          </td>
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
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          {step === "map" && (
            <Button onClick={validateWithMapping} disabled={!canContinue}>
              Continuar
            </Button>
          )}
          {step === "preview" && (
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
