import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Pencil,
  
  FileDown,
  Image as ImageIcon,
  Video as VideoIcon,
  Sparkles,
  Lock,
  MapPin,
  Calendar,
  StickyNote,
  Globe,
  Building2,
  Hash,
  Loader2,
  ExternalLink,
  Download,
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
  type PropertyMediaRow,
  type PropertyFileRow,
  useProperties,
  useSoftDeleteProperty,
} from "@/data/propertiesApi";
import { fmtMoney } from "@/data/mock";

import { logAgentEvent } from "@/data/agentEvents";
import { useAuth, useHasRole } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import JSZip from "jszip";
import { CommissionCalculator } from "@/components/properties/CommissionCalculator";
import { useAvailabilityUnits } from "@/data/availabilityApi";

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
        <Link to="/properties" search={{ q: "" }} className="text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Volver a Propiedades
        </Link>
      </PageCard>
    </AppShell>
  ),
  errorComponent: ({ error }) => (
    <AppShell title="Propiedad" subtitle="Detalle">
      <PageCard title="Error al cargar la propiedad" description={error.message}>
        <Link to="/properties" search={{ q: "" }} className="text-primary hover:underline inline-flex items-center gap-1">
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

  // Only admins can edit/delete. Agents only view & share.
  const canManage = !!property && isAdmin;

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
      navigate({ to: "/properties", search: { q: "" } });
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

  if (propertyQuery.isLoading) {
    return <PropertyDetailSkeleton />;
  }

  if (!property) {
    return (
      <AppShell title="Propiedad" subtitle="Detalle">
        <PageCard title="Propiedad no encontrada" description="Es posible que haya sido eliminada.">
          <Link to="/properties" search={{ q: "" }} className="text-primary hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" /> Volver a Propiedades
          </Link>
        </PageCard>
      </AppShell>
    );
  }

  return (
    <AppShell title="Propiedad" subtitle="Detalle">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: "/properties", search: { q: "" } })}
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
                search={{ q: "" }}
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
                <FichaPdfTab files={files} canManage={canManage} />
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
              {(() => {
                const explicit = (property as { website_url?: string | null }).website_url?.trim();
                const fromNotes = property.notes?.match(/https?:\/\/[^\s)]+/i)?.[0]?.replace(/[.,;:]+$/, "");
                const url = explicit || fromNotes;
                if (!url) return null;
                return (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-primary hover:bg-muted transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    <span className="truncate">{url}</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                );
              })()}
            </PageCard>

            <CommissionCalculator
              model={property.model}
              price={Number(property.price)}
              propertyId={property.id}
              agentId={user?.id}
            />
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

                <ModelAvailabilityPdfButton model={property.model} />

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

function FichaPdfTab({
  files,
  canManage,
}: {
  files: PropertyFileRow[];
  canManage: boolean;
}) {
  const pdfs = files.filter(
    (f) => f.mime_type === "application/pdf" || /\.pdf($|\?)/i.test(f.url)
  );
  const ficha = pdfs.find((f) => /ficha/i.test(f.label)) ?? pdfs[0] ?? null;

  return (
    <div className="space-y-3">
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
            Aún no se ha subido una Ficha PDF para esta propiedad
            {canManage ? (
              <>
                {" "}desde{" "}
                <Link to="/properties" search={{ q: "" }} className="text-primary hover:underline">
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

function ModelAvailabilityPdfButton({ model }: { model?: string | null }) {
  const { data: units, isLoading: loadingUnits } = useAvailabilityUnits(model ?? undefined);
  const { data: allProps, isLoading: loadingProps } = useProperties();
  const [downloading, setDownloading] = useState(false);

  if (!model) {
    return (
      <div className="text-[11px] text-muted-foreground italic">
        Asigna un modelo a la propiedad para descargar el PDF de disponibilidad.
      </div>
    );
  }

  const isLoading = loadingUnits || loadingProps;

  // Combine: prefer availability_units rows; fall back to properties of the same model
  // so the PDF always reflects the real inventory shown in the app.
  const propsOfModel = (allProps ?? []).filter(
    (p) => (p.model ?? "").toLowerCase() === model.toLowerCase(),
  );

  const items = units.length > 0
    ? units.map((u) => ({
        id: u.id,
        model: u.model,
        lot: u.lot,
        desarrollo: u.desarrollo,
        price: Number(u.price),
        delivery: u.delivery ?? "",
        status: u.status as "Available" | "Reserved" | "Sold",
        notes: u.notes ?? "",
        updatedAt: u.updated_at,
      }))
    : propsOfModel.map((p) => ({
        id: p.id,
        model: p.model ?? model,
        lot: p.lot ?? p.code,
        desarrollo: p.location ?? "",
        price: Number(p.price),
        delivery: p.delivery_date ?? "",
        status: p.status as "Available" | "Reserved" | "Sold",
        notes: p.notes ?? "",
        updatedAt: p.updated_at,
      }));

  async function handleDownload() {
    if (items.length === 0) {
      toast.info("No hay unidades de este modelo en el inventario.");
      return;
    }
    try {
      setDownloading(true);
      const today = new Date().toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
      const folio = `SAL-${new Date().getFullYear()}-${String(
        Math.floor(Math.random() * 900) + 100,
      )}`;

      const [{ pdf }, { AvailabilityPdfDoc }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/availability/AvailabilityPdfDoc"),
      ]);
      const blob = await pdf(
        <AvailabilityPdfDoc
          groups={[[model!, items as never]]}
          folio={folio}
          dateLabel={today}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Salgon_Disponibilidad_${model}_${folio}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("PDF descargado", { description: a.download });
      void logAgentEvent({ type: "availability_pdf_model", model, metadata: { count: items.length } });
    } catch (err) {
      console.error(err);
      toast.error("No se pudo generar el PDF", {
        description: err instanceof Error ? err.message : "Intenta nuevamente.",
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="w-full gap-1.5"
      onClick={handleDownload}
      disabled={downloading || isLoading}
    >
      <FileDown className="h-3.5 w-3.5" />
      {downloading
        ? "Generando…"
        : isLoading
          ? "Cargando inventario…"
          : `Descargar PDF · Modelo ${model} (${items.length})`}
    </Button>
  );
}
