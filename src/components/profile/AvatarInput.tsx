import * as React from "react";
import { useRef, useState } from "react";
import { Loader2, Upload, X, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BUCKET = "avatars";

interface AvatarInputProps {
  value: string;
  onChange: (url: string) => void;
  userId: string;
}

export function AvatarInput({ value, onChange, userId }: AvatarInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen debe pesar menos de 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(pub.publicUrl);
      toast.success("Foto actualizada");
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
        <div className="h-20 w-20 shrink-0 rounded-full border border-border bg-muted overflow-hidden grid place-items-center">
          {value ? (
            <img src={value} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <UserCircle className="h-10 w-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5"
              onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Subir foto
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" className="gap-1.5"
                onClick={() => onChange("")} disabled={uploading}>
                <X className="h-3.5 w-3.5" /> Quitar
              </Button>
            )}
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
              className="hidden" onChange={handleFile} />
          </div>
          <Input value={value} onChange={(e) => onChange(e.target.value)}
            placeholder="…o pega una URL https://" maxLength={500} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">JPG, PNG o WebP · máx. 5 MB</p>
    </div>
  );
}
