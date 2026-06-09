import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, MessageCircle, CheckCheck, FileText, X, Download, ImagePlus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeads } from "@/data/leadsApi";
import { useWhatsappTemplates } from "@/data/whatsappTemplatesApi";
import { consumeWhatsappHandoff, blobToDataUrl, type WhatsappHandoff } from "@/data/whatsappHandoff";
import { toast } from "sonner";

interface ExtraPhoto {
  id: string;
  filename: string;
  dataUrl: string;
  sizeBytes: number;
  mimeType: string;
}

const MAX_EXTRA_PHOTOS = 6;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/whatsapp")({
  component: WhatsappPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary title="WhatsApp" error={error} reset={reset} />,
});

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function WhatsappPage() {
  const { data: leads = [], isLoading: leadsLoading } = useLeads();
  const { data: templates = [], isLoading: templatesLoading } = useWhatsappTemplates();
  const [body, setBody] = useState("");
  const [to, setTo] = useState("");
  const [attachment, setAttachment] = useState<WhatsappHandoff["attachment"] | null>(null);
  const [image, setImage] = useState<WhatsappHandoff["image"] | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<ExtraPhoto[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    const slotsLeft = MAX_EXTRA_PHOTOS - extraPhotos.length;
    if (slotsLeft <= 0) {
      toast.error(`Máximo ${MAX_EXTRA_PHOTOS} fotos adicionales`);
      return;
    }
    const accepted = files.filter((f) => f.type.startsWith("image/")).slice(0, slotsLeft);
    const rejectedType = files.length - files.filter((f) => f.type.startsWith("image/")).length;
    if (rejectedType > 0) toast.error(`${rejectedType} archivo(s) ignorados (no son imágenes)`);
    const next: ExtraPhoto[] = [];
    for (const f of accepted) {
      if (f.size > MAX_PHOTO_BYTES) {
        toast.error(`${f.name} supera 5 MB`);
        continue;
      }
      try {
        const dataUrl = await blobToDataUrl(f);
        next.push({
          id: `${f.name}-${f.lastModified}-${f.size}`,
          filename: f.name,
          dataUrl,
          sizeBytes: f.size,
          mimeType: f.type,
        });
      } catch {
        toast.error(`No se pudo leer ${f.name}`);
      }
    }
    if (next.length) {
      setExtraPhotos((prev) => [...prev, ...next]);
      toast.success(`${next.length} foto(s) adjuntada(s)`);
    }
  }

  function removeExtraPhoto(id: string) {
    setExtraPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  // Consume handoff from Availability → WhatsApp on mount
  useEffect(() => {
    const h = consumeWhatsappHandoff();
    if (!h) return;
    setBody(h.message);
    if (h.toLeadId) setTo(h.toLeadId);
    if (h.attachment) {
      setAttachment(h.attachment);
      toast.success("PDF adjunto desde Disponibilidad", {
        description: `${h.attachment.filename} · ${formatBytes(h.attachment.sizeBytes)}`,
      });
    }
    if (h.image) {
      setImage(h.image);
      toast.success("Imagen adjunta", {
        description: `${h.image.filename} · ${formatBytes(h.image.sizeBytes)}`,
      });
    }
    if (!h.attachment && !h.image) {
      toast.success("Mensaje pre-cargado", {
        description: "Revisa el contenido antes de enviar.",
      });
    }
  }, []);

  // Select the first lead by default once they load, unless a handoff already
  // pre-selected one.
  useEffect(() => {
    if (!to && leads.length > 0) setTo(leads[0].id);
  }, [leads, to]);

  function send() {
    const lead = leads.find((l) => l.id === to);
    if (!lead) {
      toast.error("Selecciona un destinatario");
      return;
    }
    const parts: string[] = [];
    if (attachment) parts.push(`adjunto ${attachment.filename}`);
    if (image) parts.push(`imagen ${image.filename}`);
    if (extraPhotos.length) parts.push(`${extraPhotos.length} foto(s) extra`);
    toast.success(`Mensaje enviado a ${lead?.name}`, {
      description: parts.length
        ? `Envío simulado por WhatsApp API · ${parts.join(" · ")}`
        : "Envío simulado por WhatsApp API",
    });
    setAttachment(null);
    setImage(null);
    setExtraPhotos([]);
  }

  function downloadAttachment() {
    if (!attachment) return;
    const a = document.createElement("a");
    a.href = attachment.dataUrl;
    a.download = attachment.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <AppShell title="Integración con WhatsApp" subtitle="Envía plantillas pre-aprobadas a tus prospectos">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PageCard title="Plantillas" description="Da clic para cargar una plantilla" className="lg:col-span-1">
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setBody(t.body)}
                  className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-sm font-medium flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-success" />
                    {t.name}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.body}</div>
                </button>
              </li>
            ))}
            {templatesLoading && (
              <li className="text-center text-xs text-muted-foreground py-6">Cargando plantillas…</li>
            )}
            {!templatesLoading && templates.length === 0 && (
              <li className="text-center text-xs text-muted-foreground py-6">
                No hay plantillas. Un admin puede crearlas en Configuración.
              </li>
            )}
          </ul>
        </PageCard>

        <PageCard
          title="Redactar Mensaje"
          description="Variables: {{name}}, {{property}}, {{date}}"
          className="lg:col-span-2"
        >
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Destinatario</Label>
                <Select value={to} onValueChange={setTo} disabled={leadsLoading || leads.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={leadsLoading ? "Cargando prospectos…" : "Selecciona un prospecto"} />
                  </SelectTrigger>
                  <SelectContent>
                    {leads.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name} — {l.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!leadsLoading && leads.length === 0 && (
                  <p className="text-xs text-muted-foreground">No hay prospectos registrados todavía.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono (alterno)</Label>
                <Input placeholder="+52 …" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Mensaje</Label>
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>

            {attachment && (
              <div className="space-y-1.5">
                <Label>Documento adjunto</Label>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <div className="h-9 w-9 rounded-md bg-destructive/10 text-destructive grid place-items-center">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{attachment.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      PDF · {formatBytes(attachment.sizeBytes)}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    aria-label="Descargar adjunto"
                    onClick={downloadAttachment}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    aria-label="Quitar adjunto"
                    onClick={() => setAttachment(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {image && (
              <div className="space-y-1.5">
                <Label>Imagen adjunta</Label>
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <img
                    src={image.dataUrl}
                    alt={image.filename}
                    className="h-12 w-16 rounded-md object-cover border border-border"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{image.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {image.mimeType} · {formatBytes(image.sizeBytes)}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    aria-label="Quitar imagen"
                    onClick={() => setImage(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Fotos adicionales</Label>
                <span className="text-xs text-muted-foreground">
                  {extraPhotos.length}/{MAX_EXTRA_PHOTOS}
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoPick}
              />
              <div className="flex flex-wrap gap-2">
                {extraPhotos.map((p) => (
                  <div
                    key={p.id}
                    className="group relative h-20 w-20 rounded-md overflow-hidden border border-border bg-muted"
                  >
                    <img src={p.dataUrl} alt={p.filename} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExtraPhoto(p.id)}
                      aria-label={`Quitar ${p.filename}`}
                      className="absolute top-0.5 right-0.5 h-5 w-5 rounded-full bg-background/90 text-destructive grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {extraPhotos.length < MAX_EXTRA_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-20 w-20 rounded-md border border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors grid place-items-center text-muted-foreground"
                    aria-label="Agregar fotos"
                  >
                    <ImagePlus className="h-5 w-5" />
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Hasta {MAX_EXTRA_PHOTOS} imágenes · 5 MB c/u
              </p>
            </div>

            <div className="rounded-xl bg-[oklch(0.96_0.04_150)] p-4">
              <div className="ml-auto max-w-sm rounded-2xl rounded-br-sm bg-success text-success-foreground px-3 py-2 text-sm shadow-[var(--shadow-soft)] space-y-2">
                {image && (
                  <img
                    src={image.dataUrl}
                    alt={image.filename}
                    className="rounded-lg w-full max-h-56 object-cover border border-success-foreground/10"
                  />
                )}
                {extraPhotos.length > 0 && (
                  <div
                    className={
                      extraPhotos.length === 1
                        ? "grid grid-cols-1 gap-1"
                        : "grid grid-cols-2 gap-1"
                    }
                  >
                    {extraPhotos.slice(0, 4).map((p, i) => (
                      <div key={p.id} className="relative">
                        <img
                          src={p.dataUrl}
                          alt={p.filename}
                          className="rounded-md w-full h-24 object-cover border border-success-foreground/10"
                        />
                        {i === 3 && extraPhotos.length > 4 && (
                          <div className="absolute inset-0 rounded-md bg-black/50 grid place-items-center text-white text-sm font-semibold">
                            +{extraPhotos.length - 4}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {attachment && (
                  <div className="flex items-center gap-2 rounded-lg bg-success-foreground/10 px-2 py-1.5">
                    <FileText className="h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">{attachment.filename}</div>
                      <div className="text-[10px] opacity-80">PDF · {formatBytes(attachment.sizeBytes)}</div>
                    </div>
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">
                  {body || "La vista previa aparecerá aquí"}
                </div>
                <div className="text-[10px] opacity-80 flex items-center justify-end gap-1">
                  10:24 <CheckCheck className="h-3 w-3" />
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={send} className="gap-1.5">
                <Send className="h-4 w-4" /> Enviar por WhatsApp API
              </Button>
            </div>
          </div>
        </PageCard>
      </div>
    </AppShell>
  );
}
