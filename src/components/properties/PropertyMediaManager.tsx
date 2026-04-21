import * as React from "react";
import { useRef, useState } from "react";
import { Loader2, Trash2, Upload, FileText, Image as ImageIcon, Video as VideoIcon, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { usePropertyMedia, usePropertyFiles, type PropertyMediaRow, type PropertyFileRow } from "@/data/propertiesApi";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type MediaKind = Database["public"]["Enums"]["media_kind"];

const MEDIA_BUCKET = "property-media";
const FILES_BUCKET = "property-files";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
}

export function PropertyMediaManager({ propertyId }: { propertyId: string }) {
  const mediaQuery = usePropertyMedia(propertyId);
  const filesQuery = usePropertyFiles(propertyId);
  const media = mediaQuery.data ?? [];
  const files = filesQuery.data ?? [];

  const photos = media.filter((m) => m.kind === "photo");
  const renders = media.filter((m) => m.kind === "render");
  const videos = media.filter((m) => m.kind === "video");

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        Sube los archivos descargables que verán los agentes en la ficha de la propiedad.
        Los archivos se guardan al instante.
      </div>

      <FilesSection propertyId={propertyId} files={files} />
      <MediaSection propertyId={propertyId} kind="photo" label="Fotos" icon={<ImageIcon className="h-4 w-4" />} accept="image/*" items={photos} />
      <MediaSection propertyId={propertyId} kind="render" label="Renders" icon={<Sparkles className="h-4 w-4" />} accept="image/*" items={renders} />
      <MediaSection propertyId={propertyId} kind="video" label="Videos" icon={<VideoIcon className="h-4 w-4" />} accept="video/*" items={videos} />
    </div>
  );
}

function FilesSection({ propertyId, files }: { propertyId: string; files: PropertyFileRow[] }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("Ficha de la propiedad");
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const path = `${propertyId}/${Date.now()}-${sanitize(file.name)}`;
      const { error: upErr } = await supabase.storage.from(FILES_BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(FILES_BUCKET).getPublicUrl(path);
      const { error: insErr } = await supabase.from("property_files").insert({
        property_id: propertyId,
        label: label.trim() || file.name,
        url: pub.publicUrl,
        mime_type: file.type || null,
      });
      if (insErr) throw insErr;
      toast.success("Archivo subido");
      qc.invalidateQueries({ queryKey: ["property-files", propertyId] });
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(f: PropertyFileRow) {
    if (!confirm(`¿Eliminar "${f.label}"?`)) return;
    try {
      // Best-effort: delete storage object using path inferred from URL
      const marker = `/${FILES_BUCKET}/`;
      const idx = f.url.indexOf(marker);
      if (idx >= 0) {
        const path = f.url.substring(idx + marker.length);
        await supabase.storage.from(FILES_BUCKET).remove([path]);
      }
      const { error } = await supabase.from("property_files").delete().eq("id", f.id);
      if (error) throw error;
      toast.success("Archivo eliminado");
      qc.invalidateQueries({ queryKey: ["property-files", propertyId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center gap-1.5 text-sm font-medium">
        <FileText className="h-4 w-4" /> Archivos descargables (Ficha PDF, brochure, etc.)
        <span className="text-xs text-muted-foreground font-normal">({files.length})</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Etiqueta</Label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ficha de la propiedad" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">&nbsp;</Label>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto gap-1.5"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Subir archivo
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-sm">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate flex-1">{f.label}</span>
              <a href={f.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => handleDelete(f)}
                className="text-destructive hover:opacity-80"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaSection({
  propertyId,
  kind,
  label,
  icon,
  accept,
  items,
}: {
  propertyId: string;
  kind: MediaKind;
  label: string;
  icon: React.ReactNode;
  accept: string;
  items: PropertyMediaRow[];
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    let okCount = 0;
    try {
      for (const file of Array.from(fileList)) {
        const path = `${propertyId}/${kind}/${Date.now()}-${sanitize(file.name)}`;
        const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
          contentType: file.type || undefined,
          upsert: false,
        });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
        const { error: insErr } = await supabase.from("property_media").insert({
          property_id: propertyId,
          kind,
          url: pub.publicUrl,
          title: file.name,
          sort_order: items.length + okCount,
        });
        if (insErr) {
          toast.error(`${file.name}: ${insErr.message}`);
          continue;
        }
        okCount++;
      }
      if (okCount > 0) toast.success(`${okCount} ${label.toLowerCase()} subido(s)`);
      qc.invalidateQueries({ queryKey: ["property-media", propertyId] });
      if (inputRef.current) inputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(m: PropertyMediaRow) {
    if (!confirm(`¿Eliminar este elemento?`)) return;
    try {
      const marker = `/${MEDIA_BUCKET}/`;
      const idx = m.url.indexOf(marker);
      if (idx >= 0) {
        const path = m.url.substring(idx + marker.length);
        await supabase.storage.from(MEDIA_BUCKET).remove([path]);
      }
      const { error } = await supabase.from("property_media").delete().eq("id", m.id);
      if (error) throw error;
      toast.success("Eliminado");
      qc.invalidateQueries({ queryKey: ["property-media", propertyId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          {icon} {label}
          <span className="text-xs text-muted-foreground font-normal">({items.length})</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Subir
        </Button>
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={handleUpload} />
      </div>
      {items.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {items.map((m) => (
            <div key={m.id} className="relative group rounded-md overflow-hidden border border-border bg-muted aspect-video">
              {kind === "video" ? (
                <div className="w-full h-full grid place-items-center bg-black/80 text-white">
                  <VideoIcon className="h-6 w-6" />
                </div>
              ) : (
                <img src={m.url} alt={m.title || label} className="w-full h-full object-cover" loading="lazy" />
              )}
              <button
                type="button"
                onClick={() => handleDelete(m)}
                className="absolute top-1 right-1 h-6 w-6 rounded-md bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center"
                aria-label="Eliminar"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
