import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Pencil,
  MessageCircle,
  FileDown,
  Image as ImageIcon,
  Video as VideoIcon,
  Sparkles,
  RefreshCw,
  Lock,
  MapPin,
  Calendar,
  StickyNote,
  Building2,
  Hash,
  Loader2,
  ExternalLink,
  Download,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useProperty,
  usePropertyMedia,
  usePropertyFiles,
  type PropertyRow,
  type PropertyMediaRow,
} from "@/data/propertiesApi";
import { fmtMoney } from "@/data/mock";
import { setWhatsappHandoff, blobToDataUrl } from "@/data/whatsappHandoff";
import { useAuth, useHasRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/properties/$id")({
  component: PropertyDetailPage,
  notFoundComponent: () => (
    <AppShell title="Propiedad" subtitle="Detalle">
      <PageCard title="Propiedad no encontrada" description="Verifica el enlace o vuelve al listado.">
        <Link to="/properties" className="text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver a Propiedades
        </Link>
      </PageCard>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell title="Propiedad" subtitle="Detalle">
      <PageCard title="Error al cargar la propiedad" description={error.message}>
        <Link to="/properties" className="text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </PageCard>
    </AppShell>
  ),
});

function PropertyDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = useHasRole("admin");

  const propertyQuery = useProperty(id);
  const mediaQuery = usePropertyMedia(id);
  const filesQuery = usePropertyFiles(id);

  const property = propertyQuery.data;
  const media = mediaQuery.data ?? [];
  const files = filesQuery.data ?? [];

  const canManage = !!property && (isAdmin || (!!user && property.agent_id === user.id));

  // Realtime sync for status updates from Disponibilidad module
  const [lastSync, setLastSync] = useState<Date>(new Date());
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`property-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "properties", filter: `id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["property", id] });
          setLastSync(new Date());
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  const photos = useMemo(() => media.filter((m) => m.kind === "photo"), [media]);
  const renders = useMemo(() => media.filter((m) => m.kind === "render"), [media]);
  const videos = useMemo(() => media.filter((m) => m.kind === "video"), [media]);

  if (propertyQuery.isLoading) {
    return (
      <AppShell title="Propiedad" subtitle="Detalle">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!property) {
    return (
      <AppShell title="Propiedad" subtitle="Detalle">
        <PageCard title="Propiedad no encontrada" description="Es posible que haya sido eliminada.">
          <Link to="/properties" className="text-primary hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Volver a Propiedades
          </Link>
        </PageCard>
      </AppShell>
    );
  }

  async function handleWhatsapp() {
    if (!property) return;
    const message =
      `¡Hola! Te comparto esta propiedad:\n\n` +
      `🏠 *${property.title}*\n` +
      `📍 ${property.location}\n` +
      `💰 ${fmtMoney(Number(property.price))}\n` +
      `🛏️ ${property.bedrooms} rec · 🛁 ${property.bathrooms} baños · 📐 ${property.area} m²\n\n` +
      `Folio: ${property.code}\n` +
      `¿Te gustaría agendar una visita?`;

    let image: { filename: string; dataUrl: string; sizeBytes: number; mimeType: string } | undefined;
    const cover = property.image_url || photos[0]?.url;
    if (cover) {
      try {
        const res = await fetch(cover);
        if (res.ok) {
          const blob = await res.blob();
          const mimeType = blob.type || "image/jpeg";
          const ext = mimeType.split("/")[1]?.split("+")[0] || "jpg";
          const dataUrl = await blobToDataUrl(blob);
          image = { filename: `${property.code}.${ext}`, dataUrl, sizeBytes: blob.size, mimeType };
        }
      } catch (e) {
        console.error("No se pudo adjuntar la imagen", e);
      }
    }

    setWhatsappHandoff({ message, image, meta: { propertyId: property.id } });
    navigate({ to: "/whatsapp" });
  }

  function handleGeneratePdf() {
    if (!property) return;
    generatePropertyPdf(property);
  }

  return (
    <AppShell title="Propiedad" subtitle="Detalle">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/properties" })}
            aria-label="Volver"
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight truncate">{property.title}</h1>
              <StatusBadge status={property.status} />
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Hash className="h-3.5 w-3.5" /> Folio {property.code}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button onClick={handleWhatsapp} className="gap-1.5">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="outline" onClick={handleGeneratePdf} className="gap-1.5">
            <FileDown className="h-4 w-4" /> Generar PDF
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/properties" })}
            disabled={!canManage}
            className="gap-1.5"
            title={!canManage ? "Solo el agente asignado o un admin puede editar" : undefined}
          >
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["property", id] });
              qc.invalidateQueries({ queryKey: ["property-media", id] });
              qc.invalidateQueries({ queryKey: ["property-files", id] });
              setLastSync(new Date());
              toast.success("Datos actualizados");
            }}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" /> Refrescar
          </Button>
        </div>

        {/* Cover */}
        {(property.image_url || photos[0]) && (
          <div className="rounded-xl overflow-hidden border border-border bg-muted">
            <img
              src={property.image_url || photos[0].url}
              alt={property.title}
              className="w-full h-56 sm:h-72 object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Hero: Galería + Descargas con tabs */}
        <PageCard
          title="Galería y archivos descargables"
          description="Ficha PDF, fotos, renders y videos de la propiedad"
          action={
            canManage ? (
              <Link
                to="/properties"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <Pencil className="h-3.5 w-3.5" /> Subir / gestionar archivos
              </Link>
            ) : null
          }
        >
          <Tabs defaultValue="ficha" className="w-full">
            <TabsList className="w-full justify-start flex-wrap h-auto">
              <TabsTrigger value="ficha" className="gap-1.5">
                <FileDown className="h-3.5 w-3.5" /> Ficha PDF
              </TabsTrigger>
              <TabsTrigger value="photos" className="gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" /> Fotos
                <span className="text-[10px] text-muted-foreground">({photos.length})</span>
              </TabsTrigger>
              <TabsTrigger value="renders" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Renders
                <span className="text-[10px] text-muted-foreground">({renders.length})</span>
              </TabsTrigger>
              <TabsTrigger value="videos" className="gap-1.5">
                <VideoIcon className="h-3.5 w-3.5" /> Videos
                <span className="text-[10px] text-muted-foreground">({videos.length})</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Archivos
                <span className="text-[10px] text-muted-foreground">({files.length})</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ficha" className="mt-4">
              <FichaPdfTab
                files={files}
                onGenerate={handleGeneratePdf}
                canManage={canManage}
              />
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              <Gallery title="Fotos" icon={<ImageIcon className="h-4 w-4" />} items={photos} />
            </TabsContent>

            <TabsContent value="renders" className="mt-4">
              <Gallery title="Renders" icon={<Sparkles className="h-4 w-4" />} items={renders} />
            </TabsContent>

            <TabsContent value="videos" className="mt-4">
              <VideoGallery items={videos} />
            </TabsContent>

            <TabsContent value="files" className="mt-4 space-y-2">
              {files.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                  No hay archivos cargados.
                  {canManage && (
                    <>
                      {" "}
                      <Link to="/properties" className="text-primary hover:underline">
                        Súbelos desde Editar propiedad
                      </Link>
                      .
                    </>
                  )}
                </div>
              ) : (
                files.map((f) => (
                  <a
                    key={f.id}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5 text-primary" /> {f.label}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </a>
                ))
              )}
            </TabsContent>
          </Tabs>
        </PageCard>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <PageCard title="Información general" description="Detalles del inmueble">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Modelo">
                  {property.model || "—"}
                </Field>
                <Field icon={<Hash className="h-3.5 w-3.5" />} label="Lote">
                  {property.lot || "—"}
                </Field>
                <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Ubicación">
                  {property.location}
                </Field>
                <Field label="Precio">
                  <span className="text-primary font-semibold tabular-nums">{fmtMoney(Number(property.price))}</span>
                </Field>
                <Field label="Recámaras">{property.bedrooms}</Field>
                <Field label="Baños">{property.bathrooms}</Field>
                <Field label="Área">{property.area} m²</Field>
                <Field icon={<Calendar className="h-3.5 w-3.5" />} label="Fecha de entrega">
                  {property.delivery_date
                    ? new Date(property.delivery_date).toLocaleDateString("es-MX", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "Por definir"}
                </Field>
                <Field label="Agente">{property.agent?.full_name ?? "Sin asignar"}</Field>
              </div>
              {property.notes && (
                <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
                    <StickyNote className="h-3.5 w-3.5" /> Notas
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{property.notes}</p>
                </div>
              )}
            </PageCard>
          </div>

          <div className="space-y-4">
            <PageCard
              title="Disponibilidad en tiempo real"
              description="Sincronizada desde el módulo de Disponibilidad"
            >
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Estatus actual</div>
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={property.status} />
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                      </span>
                      EN VIVO
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div>
                    Última actualización:{" "}
                    <span className="text-foreground font-medium">
                      {new Date(property.updated_at).toLocaleString("es-MX")}
                    </span>
                  </div>
                  <div>
                    Sincronizado:{" "}
                    <span className="text-foreground font-medium">{lastSync.toLocaleTimeString("es-MX")}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-[11px] text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                  <span>
                    La disponibilidad es <strong className="text-foreground">solo lectura</strong> aquí. Se controla
                    desde el módulo{" "}
                    <Link to="/availability" className="text-primary hover:underline">
                      Disponibilidad
                    </Link>
                    .
                  </span>
                </div>
              </div>
            </PageCard>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ icon, label, children }: { icon?: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

function Gallery({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: PropertyMediaRow[];
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
        {icon} {title}
        <span className="text-xs text-muted-foreground font-normal">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Sin {title.toLowerCase()} disponibles.
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
          {items.map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noreferrer"
              className="snap-start shrink-0 w-40 h-28 rounded-lg overflow-hidden border border-border bg-muted hover:opacity-90 transition-opacity"
            >
              <img src={m.url} alt={m.title || title} className="w-full h-full object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoGallery({ items }: { items: PropertyMediaRow[] }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
        <VideoIcon className="h-4 w-4" /> Videos
        <span className="text-xs text-muted-foreground font-normal">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Sin videos disponibles.
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
          {items.map((m) => (
            <a
              key={m.id}
              href={m.url}
              target="_blank"
              rel="noreferrer"
              className="snap-start shrink-0 w-48 h-28 rounded-lg overflow-hidden border border-border bg-black/80 grid place-items-center text-white text-xs gap-1 hover:opacity-90 transition-opacity"
            >
              <VideoIcon className="h-6 w-6" />
              <span className="truncate max-w-[10rem] px-2">{m.title || "Video"}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function FichaPdfTab({
  files,
  onGenerate,
  canManage,
}: {
  files: PropertyFileRow[];
  onGenerate: () => void;
  canManage: boolean;
}) {
  const pdfs = files.filter(
    (f) => f.mime_type === "application/pdf" || /\.pdf($|\?)/i.test(f.url)
  );
  const ficha = pdfs.find((f) => /ficha/i.test(f.label)) ?? pdfs[0] ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onGenerate} className="gap-1.5">
          <FileDown className="h-4 w-4" /> Generar Ficha (PDF)
        </Button>
        {ficha && (
          <a
            href={ficha.url}
            target="_blank"
            rel="noreferrer"
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted transition-colors"
          >
            <Download className="h-4 w-4 text-primary" /> Descargar PDF cargado
          </a>
        )}
        {ficha && (
          <a
            href={ficha.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir en pestaña nueva
          </a>
        )}
      </div>

      {ficha ? (
        <div className="rounded-lg border border-border overflow-hidden bg-muted">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-background">
            <div className="text-xs font-medium truncate flex items-center gap-1.5">
              <FileDown className="h-3.5 w-3.5 text-primary" /> {ficha.label}
            </div>
            <div className="text-[10px] text-muted-foreground">PDF</div>
          </div>
          <object
            data={ficha.url}
            type="application/pdf"
            className="w-full h-[60vh] bg-background"
            aria-label={`Vista previa de ${ficha.label}`}
          >
            <div className="p-6 text-center text-sm text-muted-foreground">
              Tu navegador no puede mostrar el PDF.{" "}
              <a href={ficha.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Descárgalo aquí
              </a>
              .
            </div>
          </object>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center space-y-2">
          <FileDown className="h-8 w-8 mx-auto text-muted-foreground" />
          <div className="text-sm font-medium">No hay Ficha PDF cargada</div>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Genera una ficha automática con los datos de la propiedad o sube tu propio PDF
            {canManage ? (
              <>
                {" "}desde{" "}
                <Link to="/properties" className="text-primary hover:underline">
                  Editar propiedad
                </Link>
                .
              </>
            ) : (
              "."
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function DownloadGroup({
  label,
  icon,
  items,
  preferOpen = false,
}: {
  label: string;
  icon: React.ReactNode;
  items: PropertyMediaRow[];
  preferOpen?: boolean;
}) {
  const disabled = items.length === 0;
  function handleClick() {
    if (disabled) return;
    items.forEach((m, i) => {
      setTimeout(() => {
        if (preferOpen) {
          window.open(m.url, "_blank", "noopener,noreferrer");
        } else {
          const a = document.createElement("a");
          a.href = m.url;
          a.target = "_blank";
          a.rel = "noreferrer";
          a.download = m.title || "";
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      }, i * 120);
    });
  }
  return (
    <Button
      variant="outline"
      onClick={handleClick}
      disabled={disabled}
      className="w-full justify-start gap-2"
      title={disabled ? "No hay elementos disponibles" : undefined}
    >
      {icon} {label}
      <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
    </Button>
  );
}

// --- Simple client-side PDF generator (HTML → print) ---
function generatePropertyPdf(property: PropertyRow) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!w) {
    toast.error("Tu navegador bloqueó la ventana del PDF. Permite popups e intenta de nuevo.");
    return;
  }
  const fmt = (v: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<title>Ficha ${property.code} — ${property.title}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;margin:32px}
  h1{font-size:22px;margin:0 0 4px} .muted{color:#64748b;font-size:12px}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#eef2ff;color:#3730a3;margin-left:8px}
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}
  .cell{border:1px solid #e2e8f0;border-radius:8px;padding:10px}
  .cell .label{font-size:10px;text-transform:uppercase;color:#64748b;letter-spacing:.04em}
  .cell .value{font-size:14px;font-weight:600;margin-top:2px}
  img.cover{width:100%;height:280px;object-fit:cover;border-radius:12px;margin-top:12px}
  .notes{margin-top:16px;padding:12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc;font-size:13px;white-space:pre-wrap}
  .foot{margin-top:24px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px}
  @media print{ body{margin:16mm} .noprint{display:none} }
</style></head><body>
  <h1>${escapeHtml(property.title)} <span class="badge">${escapeHtml(property.status)}</span></h1>
  <div class="muted">Folio ${escapeHtml(property.code)} · ${escapeHtml(property.location)}</div>
  ${property.image_url ? `<img class="cover" src="${escapeHtml(property.image_url)}" />` : ""}
  <div class="grid">
    <div class="cell"><div class="label">Modelo</div><div class="value">${escapeHtml(property.model || "—")}</div></div>
    <div class="cell"><div class="label">Lote</div><div class="value">${escapeHtml(property.lot || "—")}</div></div>
    <div class="cell"><div class="label">Precio</div><div class="value">${fmt(Number(property.price))}</div></div>
    <div class="cell"><div class="label">Recámaras</div><div class="value">${property.bedrooms}</div></div>
    <div class="cell"><div class="label">Baños</div><div class="value">${property.bathrooms}</div></div>
    <div class="cell"><div class="label">Área</div><div class="value">${property.area} m²</div></div>
    <div class="cell"><div class="label">Fecha de entrega</div><div class="value">${
      property.delivery_date
        ? new Date(property.delivery_date).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" })
        : "Por definir"
    }</div></div>
    <div class="cell" style="grid-column:span 2"><div class="label">Ubicación</div><div class="value">${escapeHtml(
      property.location
    )}</div></div>
  </div>
  ${property.notes ? `<div class="notes"><strong>Notas:</strong><br/>${escapeHtml(property.notes)}</div>` : ""}
  <div class="foot">Generado ${new Date().toLocaleString("es-MX")} · Salgon · Ficha de propiedad</div>
  <div class="noprint" style="margin-top:16px;text-align:center">
    <button onclick="window.print()" style="padding:8px 16px;border-radius:6px;border:1px solid #cbd5e1;cursor:pointer;font-weight:600">Imprimir / Guardar PDF</button>
  </div>
  <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),300))</script>
</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
