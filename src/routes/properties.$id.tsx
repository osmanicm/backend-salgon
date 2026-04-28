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
  X,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PropertyFormDialog } from "./properties";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PropertyDetailSkeleton } from "@/components/properties/PropertyDetailSkeleton";
import {
  FichaPdfTabSkeleton,
  GalleryTabSkeleton,
  VideosTabSkeleton,
  FilesTabSkeleton,
} from "@/components/properties/PropertyTabSkeletons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useProperty,
  usePropertyMedia,
  usePropertyFiles,
  type PropertyRow,
  type PropertyMediaRow,
  type PropertyFileRow,
  useProperties,
  useSoftDeleteProperty,
} from "@/data/propertiesApi";
import { fmtMoney } from "@/data/mock";
import { setWhatsappHandoff, blobToDataUrl } from "@/data/whatsappHandoff";
import { useAuth, useHasRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import JSZip from "jszip";

function filenameFromUrl(url: string, fallback = "archivo"): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : fallback;
  } catch {
    return fallback;
  }
}

async function triggerDownload(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function downloadAsZip(
  items: { url: string; title?: string | null }[],
  zipName: string,
) {
  if (items.length === 0) return;
  const zip = new JSZip();
  let i = 0;
  for (const it of items) {
    try {
      const res = await fetch(it.url);
      if (!res.ok) continue;
      const blob = await res.blob();
      const base = (it.title?.trim() || filenameFromUrl(it.url, `archivo-${++i}`)).replace(/[\\/:*?"<>|]+/g, "-");
      zip.file(base, blob);
    } catch {
      // skip failed item
    }
  }
  const out = await zip.generateAsync({ type: "blob" });
  const objectUrl = URL.createObjectURL(out);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

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

  // CRUD dialogs
  const allPropertiesQuery = useProperties();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const softDelete = useSoftDeleteProperty();
  async function confirmDelete() {
    if (!property) return;
    try {
      await softDelete.mutateAsync(property.id);
      toast.success(`"${property.title}" enviada a la papelera`);
      navigate({ to: "/properties" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    }
  }

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

  const MAX_PDF_RETRIES = 3;
  type PdfStatus = "idle" | "queued" | "generating" | "ready" | "error" | "cancelled";
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfAttempt, setPdfAttempt] = useState(0);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfStatus, setPdfStatus] = useState<PdfStatus>("idle");
  const [pdfStartedAt, setPdfStartedAt] = useState<number | null>(null);
  const [pdfElapsedMs, setPdfElapsedMs] = useState(0);
  const [pdfDurationMs, setPdfDurationMs] = useState<number | null>(null);
  const pdfCancelRef = React.useRef<{ cancelled: boolean } | null>(null);

  // Tick elapsed time while generating/queued
  useEffect(() => {
    if (pdfStatus !== "generating" && pdfStatus !== "queued") return;
    const start = pdfStartedAt ?? Date.now();
    const interval = setInterval(() => setPdfElapsedMs(Date.now() - start), 100);
    return () => clearInterval(interval);
  }, [pdfStatus, pdfStartedAt]);

  // Cancel if user closes/hides the tab while generating
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden" && pdfCancelRef.current && !pdfCancelRef.current.cancelled) {
        pdfCancelRef.current.cancelled = true;
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (pdfCancelRef.current) pdfCancelRef.current.cancelled = true;
    };
  }, []);

  if (propertyQuery.isLoading) {
    return <PropertyDetailSkeleton />;
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
    const cover = normalizeImageUrl(property.image_url) || photos[0]?.url;
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

  function cancelPdf() {
    if (pdfCancelRef.current) pdfCancelRef.current.cancelled = true;
    setPdfStatus("cancelled");
    setGeneratingPdf(false);
    toast.message("Generación cancelada");
  }

  async function handleGeneratePdf(isRetry = false) {
    if (!property || generatingPdf) return;
    const attempt = isRetry ? pdfAttempt + 1 : 1;
    const token = { cancelled: false };
    pdfCancelRef.current = token;
    setPdfAttempt(attempt);
    setGeneratingPdf(true);
    setPdfError(null);
    setPdfDurationMs(null);
    setPdfElapsedMs(0);
    const startedAt = Date.now();
    setPdfStartedAt(startedAt);
    setPdfStatus("queued");

    const loadingMsg = isRetry
      ? `Reintentando Ficha PDF… (intento ${attempt} de ${MAX_PDF_RETRIES})`
      : "Generando Ficha PDF…";
    const t = toast.loading(loadingMsg);

    // Brief queued phase to surface the "En cola" state
    await new Promise((r) => setTimeout(r, 250));
    if (token.cancelled) {
      toast.dismiss(t);
      return;
    }
    setPdfStatus("generating");

    try {
      await generatePropertyPdf(property);
      if (token.cancelled) {
        toast.dismiss(t);
        return;
      }
      const duration = Date.now() - startedAt;
      setPdfDurationMs(duration);
      setPdfStatus("ready");
      toast.success(`Ficha PDF lista en ${(duration / 1000).toFixed(1)}s.`, { id: t });
      setPdfAttempt(0);
      setPdfError(null);
    } catch (e) {
      if (token.cancelled) {
        toast.dismiss(t);
        return;
      }
      const raw = e instanceof Error ? e.message : String(e);
      const isPopupBlocked = /popup/i.test(raw);
      const baseDescription = isPopupBlocked
        ? "Tu navegador bloqueó la ventana emergente. Permite popups para este sitio e inténtalo de nuevo."
        : raw || "Ocurrió un error inesperado.";
      setPdfError(baseDescription);
      setPdfStatus("error");
      setPdfDurationMs(Date.now() - startedAt);

      if (attempt >= MAX_PDF_RETRIES) {
        toast.error("Se alcanzó el máximo de reintentos", {
          id: t,
          description: `${baseDescription} Intentos: ${attempt}/${MAX_PDF_RETRIES}. Espera unos segundos antes de volver a intentar.`,
          duration: 12000,
          action: {
            label: "Empezar de nuevo",
            onClick: () => {
              setPdfAttempt(0);
              setPdfError(null);
              void handleGeneratePdf(false);
            },
          },
        });
      } else {
        toast.error("No se pudo generar el PDF", {
          id: t,
          description: `${baseDescription} (Intento ${attempt}/${MAX_PDF_RETRIES})`,
          duration: 10000,
          action: {
            label: `Reintentar (${MAX_PDF_RETRIES - attempt} restantes)`,
            onClick: () => {
              void handleGeneratePdf(true);
            },
          },
        });
      }
    } finally {
      setGeneratingPdf(false);
      if (pdfCancelRef.current === token) pdfCancelRef.current = null;
    }
  }
  function handleRetryPdf() {
    if (pdfAttempt >= MAX_PDF_RETRIES) {
      setPdfAttempt(0);
      setPdfError(null);
      void handleGeneratePdf(false);
    } else {
      void handleGeneratePdf(true);
    }
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <Button onClick={handleWhatsapp} className="gap-1.5">
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </Button>
          <Button variant="outline" onClick={() => handleGeneratePdf()} disabled={generatingPdf} className="gap-1.5">
            {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {generatingPdf ? "Generando…" : "Generar PDF"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setEditing(true)}
            disabled={!canManage}
            className="gap-1.5"
            title={!canManage ? "Solo el agente asignado o un admin puede editar" : undefined}
          >
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button
            variant="outline"
            onClick={() => setDeleting(true)}
            disabled={!canManage}
            className="gap-1.5 text-destructive hover:text-destructive"
            title={!canManage ? "Solo el agente asignado o un admin puede eliminar" : undefined}
          >
            <Trash2 className="h-4 w-4" /> Eliminar
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
              src={normalizeImageUrl(property.image_url) || photos[0].url}
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
            </TabsList>

            <TabsContent value="ficha" className="mt-4">
              {filesQuery.isLoading ? (
                <FichaPdfTabSkeleton />
              ) : (
                <FichaPdfTab
                  files={files}
                  onGenerate={() => handleGeneratePdf()}
                  onRetry={handleRetryPdf}
                  onCancel={cancelPdf}
                  generating={generatingPdf}
                  canManage={canManage}
                  error={pdfError}
                  attempt={pdfAttempt}
                  maxRetries={MAX_PDF_RETRIES}
                  status={pdfStatus}
                  elapsedMs={pdfElapsedMs}
                  durationMs={pdfDurationMs}
                />
              )}
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              {mediaQuery.isLoading ? (
                <GalleryTabSkeleton kind="photos" />
              ) : (
                <Gallery title="Fotos" icon={<ImageIcon className="h-4 w-4" />} items={photos} zipBaseName={property.code} />
              )}
            </TabsContent>

            <TabsContent value="renders" className="mt-4">
              {mediaQuery.isLoading ? (
                <GalleryTabSkeleton kind="renders" />
              ) : (
                <Gallery title="Renders" icon={<Sparkles className="h-4 w-4" />} items={renders} zipBaseName={property.code} />
              )}
            </TabsContent>

            <TabsContent value="videos" className="mt-4">
              {mediaQuery.isLoading ? (
                <VideosTabSkeleton />
              ) : (
                <VideoGallery items={videos} zipBaseName={property.code} />
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

      {/* Edit dialog (reuses the form from the list page) */}
      <PropertyFormDialog
        open={editing}
        onOpenChange={setEditing}
        existing={allPropertiesQuery.data ?? []}
        initial={property}
        canManageInitial={canManage}
      />

      {/* Delete confirm */}
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar a la papelera?</AlertDialogTitle>
            <AlertDialogDescription>
              "{property.title}" se ocultará del catálogo. Un admin puede restaurarla más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {softDelete.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  zipBaseName,
}: {
  title: string;
  icon: React.ReactNode;
  items: PropertyMediaRow[];
  zipBaseName: string;
}) {
  const [zipping, setZipping] = useState(false);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  async function handleZip() {
    setZipping(true);
    const t = toast.loading(`Preparando ${title.toLowerCase()}…`);
    try {
      await downloadAsZip(items, `${zipBaseName}-${slug}.zip`);
      toast.success(`${title} descargados`, { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar", { id: t });
    } finally {
      setZipping(false);
    }
  }

  async function handleOne(m: PropertyMediaRow) {
    try {
      await triggerDownload(m.url, m.title || filenameFromUrl(m.url, `${slug}.jpg`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {icon} {title}
          <span className="text-xs text-muted-foreground font-normal">({items.length})</span>
        </div>
        {items.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleZip}
            disabled={zipping}
          >
            {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Descargar todas (.zip)
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Sin {title.toLowerCase()} disponibles.
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
          {items.map((m) => (
            <div
              key={m.id}
              className="snap-start shrink-0 w-40 relative group"
            >
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="block w-40 h-28 rounded-lg overflow-hidden border border-border bg-muted hover:opacity-90 transition-opacity"
              >
                <img src={m.url} alt={m.title || title} className="w-full h-full object-cover" loading="lazy" />
              </a>
              <button
                type="button"
                onClick={() => handleOne(m)}
                className="absolute top-1 right-1 h-7 w-7 rounded-md bg-background/90 border border-border grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label="Descargar"
                title="Descargar"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VideoGallery({ items, zipBaseName }: { items: PropertyMediaRow[]; zipBaseName: string }) {
  const [zipping, setZipping] = useState(false);

  async function handleZip() {
    setZipping(true);
    const t = toast.loading("Preparando videos…");
    try {
      await downloadAsZip(items, `${zipBaseName}-videos.zip`);
      toast.success("Videos descargados", { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar", { id: t });
    } finally {
      setZipping(false);
    }
  }

  async function handleOne(m: PropertyMediaRow) {
    try {
      await triggerDownload(m.url, m.title || filenameFromUrl(m.url, "video.mp4"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al descargar");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <VideoIcon className="h-4 w-4" /> Videos
          <span className="text-xs text-muted-foreground font-normal">({items.length})</span>
        </div>
        {items.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleZip}
            disabled={zipping}
          >
            {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Descargar todos (.zip)
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Sin videos disponibles.
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
          {items.map((m) => (
            <div key={m.id} className="snap-start shrink-0 w-48 relative group">
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="block w-48 h-28 rounded-lg overflow-hidden border border-border bg-black/80 grid place-items-center text-white text-xs gap-1 hover:opacity-90 transition-opacity"
              >
                <VideoIcon className="h-6 w-6" />
                <span className="truncate max-w-[10rem] px-2">{m.title || "Video"}</span>
              </a>
              <button
                type="button"
                onClick={() => handleOne(m)}
                className="absolute top-1 right-1 h-7 w-7 rounded-md bg-background/90 border border-border grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                aria-label="Descargar"
                title="Descargar"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type PdfStatusValue = "idle" | "queued" | "generating" | "ready" | "error" | "cancelled";

function PdfStatusIndicator({
  status,
  elapsedMs,
  durationMs,
  attempt,
  maxRetries,
}: {
  status: PdfStatusValue;
  elapsedMs: number;
  durationMs: number | null;
  attempt: number;
  maxRetries: number;
}) {
  if (status === "idle") return null;
  const meta: Record<PdfStatusValue, { label: string; cls: string; dot: string }> = {
    idle: { label: "Inactivo", cls: "", dot: "" },
    queued: {
      label: "En cola",
      cls: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400",
      dot: "bg-amber-500",
    },
    generating: {
      label: "Generando",
      cls: "border-primary/40 bg-primary/5 text-primary",
      dot: "bg-primary",
    },
    ready: {
      label: "Listo",
      cls: "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
    error: {
      label: "Error",
      cls: "border-destructive/50 bg-destructive/5 text-destructive",
      dot: "bg-destructive",
    },
    cancelled: {
      label: "Cancelado",
      cls: "border-border bg-muted text-muted-foreground",
      dot: "bg-muted-foreground",
    },
  };
  const m = meta[status];
  const live = status === "queued" || status === "generating";
  const seconds = ((live ? elapsedMs : durationMs ?? elapsedMs) / 1000).toFixed(1);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.cls}`}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-1.5 w-1.5">
        {live && (
          <span className={`absolute inline-flex h-full w-full rounded-full ${m.dot} opacity-60 animate-ping`} />
        )}
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${m.dot}`} />
      </span>
      <span>{m.label}</span>
      <span className="tabular-nums opacity-80">· {seconds}s</span>
      {attempt > 0 && (status === "generating" || status === "error" || status === "queued") && (
        <span className="opacity-70">· {attempt}/{maxRetries}</span>
      )}
    </span>
  );
}

function FichaPdfTab({
  files,
  onGenerate,
  onRetry,
  onCancel,
  generating,
  canManage,
  error,
  attempt,
  maxRetries,
  status,
  elapsedMs,
  durationMs,
}: {
  files: PropertyFileRow[];
  onGenerate: () => void;
  onRetry: () => void;
  onCancel: () => void;
  generating: boolean;
  canManage: boolean;
  error: string | null;
  attempt: number;
  maxRetries: number;
  status: PdfStatusValue;
  elapsedMs: number;
  durationMs: number | null;
}) {
  const pdfs = files.filter(
    (f) => f.mime_type === "application/pdf" || /\.pdf($|\?)/i.test(f.url)
  );
  const ficha = pdfs.find((f) => /ficha/i.test(f.label)) ?? pdfs[0] ?? null;
  const reachedMax = attempt >= maxRetries;
  const remaining = Math.max(0, maxRetries - attempt);
  const live = status === "queued" || status === "generating";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onGenerate} disabled={generating} className="gap-1.5">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          {generating ? "Generando Ficha…" : "Generar Ficha (PDF)"}
        </Button>
        {live && (
          <Button size="sm" variant="outline" onClick={onCancel} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Cancelar
          </Button>
        )}
        <PdfStatusIndicator
          status={status}
          elapsedMs={elapsedMs}
          durationMs={durationMs}
          attempt={attempt}
          maxRetries={maxRetries}
        />
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

      {(status === "error" || error) && !generating && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm space-y-2">
          <div className="flex items-start gap-2">
            <span className="text-destructive font-medium">Error al generar la Ficha PDF</span>
            {attempt > 0 && (
              <span className="text-[11px] text-muted-foreground ml-auto shrink-0">
                Intento {attempt}/{maxRetries}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{error}</p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              disabled={generating}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {reachedMax
                ? "Empezar de nuevo"
                : `Reintentar generación${remaining ? ` (${remaining} restantes)` : ""}`}
            </Button>
            {reachedMax && (
              <span className="text-[11px] text-muted-foreground">
                Se alcanzó el máximo de reintentos. Esto reiniciará el contador.
              </span>
            )}
          </div>
        </div>
      )}

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
function generatePropertyPdf(property: PropertyRow): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
    if (!w) {
      reject(new Error("Tu navegador bloqueó la ventana del PDF. Permite popups e intenta de nuevo."));
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
  ${property.image_url ? `<img class="cover" src="${escapeHtml(normalizeImageUrl(property.image_url))}" />` : ""}
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
    const done = () => resolve();
    if (w.document.readyState === "complete") {
      setTimeout(done, 400);
    } else {
      w.addEventListener("load", () => setTimeout(done, 400), { once: true });
      // Safety timeout in case 'load' never fires
      setTimeout(done, 3000);
    }
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
