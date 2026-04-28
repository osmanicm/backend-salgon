import * as React from "react";
import { useRef, useState } from "react";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeImageUrl } from "@/lib/imageUrl";

const BUCKET = "property-media";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
}

interface Props {
  value: string;
  onChange: (url: string) => void;
  /** propertyId es opcional: si no existe (creación nueva), usamos un folder "_new" temporal */
  propertyId?: string;
}

export function PropertyCoverInput({ value, onChange, propertyId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const previewUrl = normalizeImageUrl(value);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La imagen debe pesar menos de 10MB");
      return;
    }
    setUploading(true);
    try {
      const folder = propertyId ?? "_new";
      const path = `${folder}/cover/${Date.now()}-${sanitize(file.name)}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(pub.publicUrl);
      toast.success("Imagen subida");
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="h-20 w-28 shrink-0 rounded-md border border-border bg-muted overflow-hidden grid place-items-center">
          {previewUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <img
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
              onError={(ev) => {
                (ev.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Subir imagen
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5"
                onClick={() => onChange("")}
                disabled={uploading}
              >
                <X className="h-3.5 w-3.5" /> Quitar
              </Button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </div>
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="…o pega una URL https://"
            maxLength={500}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Sube un archivo (recomendado) o pega una URL. Los enlaces de Google Drive se convierten automáticamente.
      </p>
    </div>
  );
}
