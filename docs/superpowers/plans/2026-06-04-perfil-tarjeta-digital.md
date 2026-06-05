# Perfil de Usuario + Tarjeta Digital Pública — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir perfil editable por usuario en `/profile` y tarjeta digital pública en `/p/$id` con QR y botón de guardar contacto.

**Architecture:** La tarjeta pública es una página standalone sin auth que lee `profiles` vía anon key. El formulario de edición reutiliza `PropertyCoverInput` adaptado para el bucket `avatars`. El QR se genera client-side con `qrcode.react`.

**Tech Stack:** TanStack React Start · Supabase MCP · shadcn/ui DropdownMenu · qrcode.react · Tailwind CSS 4 · branding `#E21013`

---

## File Map

| Acción | Archivo |
|--------|---------|
| Crear | `src/data/profileApi.ts` |
| Crear | `src/components/profile/AvatarInput.tsx` |
| Crear | `src/components/profile/SocialLinks.tsx` |
| Crear | `src/components/profile/PublicCard.tsx` |
| Crear | `src/routes/profile.tsx` |
| Crear | `src/routes/p.$id.tsx` |
| Modificar | `src/components/layout/Topbar.tsx` |
| Modificar | `src/components/layout/Sidebar.tsx` |
| Modificar | `src/integrations/supabase/types.ts` |

---

## Task 1: Instalar qrcode.react

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Instalar el paquete**

```bash
bun add qrcode.react
bun add -d @types/qrcode.react
```

- [ ] **Step 2: Verificar que compila**

```bash
bun run tsc --noEmit 2>&1 | grep qrcode || echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "chore: add qrcode.react"
```

---

## Task 2: Migración de base de datos

**Files:** Supabase MCP `apply_migration`

- [ ] **Step 1: Aplicar migración via Supabase MCP**

Usar la herramienta `mcp__claude_ai_Supabase__apply_migration` con `project_id: hlqmfwqeildvbokawngt` y el siguiente SQL:

```sql
-- Nuevos campos en profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_mobile   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_office   text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS office_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio            text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS instagram      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS facebook       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linkedin       text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tiktok         text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS twitter_x      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS youtube        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS slug           text UNIQUE;

-- RLS: lectura pública (anon) para la tarjeta digital
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Profiles: public read'
  ) THEN
    CREATE POLICY "Profiles: public read"
      ON public.profiles FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- RLS: solo el propio usuario puede actualizar su perfil
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Profiles: update own'
  ) THEN
    CREATE POLICY "Profiles: update own"
      ON public.profiles FOR UPDATE TO authenticated
      USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;
```

- [ ] **Step 2: Verificar columnas creadas**

Ejecutar con `mcp__claude_ai_Supabase__execute_sql`:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```
Debe incluir `phone_mobile`, `bio`, `instagram`, `slug`, etc.

---

## Task 3: Crear bucket `avatars`

**Files:** Supabase MCP `apply_migration`

- [ ] **Step 1: Crear bucket y RLS via MCP**

Usar `mcp__claude_ai_Supabase__apply_migration`:

```sql
-- Bucket avatars (público, 5MB, imágenes)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS storage: cualquier autenticado puede subir su propio avatar
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Avatars: authenticated upload own'
  ) THEN
    CREATE POLICY "Avatars: authenticated upload own"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Avatars: public read'
  ) THEN
    CREATE POLICY "Avatars: public read"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'avatars');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Avatars: delete own'
  ) THEN
    CREATE POLICY "Avatars: delete own"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END $$;
```

- [ ] **Step 2: Verificar bucket**

Ejecutar con `mcp__claude_ai_Supabase__execute_sql`:
```sql
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'avatars';
```

---

## Task 4: Regenerar tipos TypeScript de Supabase

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Generar tipos**

Usar `mcp__claude_ai_Supabase__generate_typescript_types` con `project_id: hlqmfwqeildvbokawngt` y sobreescribir `src/integrations/supabase/types.ts`.

- [ ] **Step 2: Verificar que profiles tiene los nuevos campos**

```bash
grep "phone_mobile\|instagram\|slug" src/integrations/supabase/types.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "feat: migrate profiles + avatars bucket"
```

---

## Task 5: profileApi.ts

**Files:**
- Create: `src/data/profileApi.ts`

- [ ] **Step 1: Crear el archivo**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type ProfileRow = Tables<"profiles">;
export type ProfileUpdate = TablesUpdate<"profiles">;

const KEY = (id: string) => ["profile", id];

export function useProfile(id?: string) {
  return useQuery({
    enabled: !!id,
    queryKey: KEY(id!),
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ProfileUpdate }) => {
      const { data, error } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as ProfileRow;
    },
    onSuccess: (row) => qc.invalidateQueries({ queryKey: KEY(row.id) }),
  });
}

export function usePublicProfile(id: string | undefined) {
  return useQuery({
    enabled: !!id,
    queryKey: ["public-profile", id],
    queryFn: async (): Promise<ProfileRow | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
```

- [ ] **Step 2: Verificar que compila**

```bash
bun run tsc --noEmit 2>&1 | grep profileApi || echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/data/profileApi.ts
git commit -m "feat: profileApi hooks (useProfile, useUpdateProfile, usePublicProfile)"
```

---

## Task 6: AvatarInput.tsx

**Files:**
- Create: `src/components/profile/AvatarInput.tsx`

- [ ] **Step 1: Crear componente**

```tsx
import * as React from "react";
import { useRef, useState } from "react";
import { Loader2, Upload, X, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BUCKET = "avatars";

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
}

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
```

- [ ] **Step 2: Verificar compilación**

```bash
bun run tsc --noEmit 2>&1 | grep AvatarInput || echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/AvatarInput.tsx
git commit -m "feat: AvatarInput component (upload + URL)"
```

---

## Task 7: SocialLinks.tsx

**Files:**
- Create: `src/components/profile/SocialLinks.tsx`

- [ ] **Step 1: Crear componente**

```tsx
import type { ProfileRow } from "@/data/profileApi";

const SOCIAL_CONFIG = [
  { key: "instagram" as const, label: "Instagram", emoji: "📸", base: "https://instagram.com/" },
  { key: "facebook" as const, label: "Facebook", emoji: "📘", base: "https://facebook.com/" },
  { key: "linkedin" as const, label: "LinkedIn", emoji: "💼", base: "https://linkedin.com/in/" },
  { key: "tiktok" as const, label: "TikTok", emoji: "🎵", base: "https://tiktok.com/@" },
  { key: "twitter_x" as const, label: "X", emoji: "✖", base: "https://x.com/" },
  { key: "youtube" as const, label: "YouTube", emoji: "▶", base: "https://youtube.com/@" },
  { key: "website" as const, label: "Sitio web", emoji: "🌐", base: "" },
] as const;

type SocialKey = typeof SOCIAL_CONFIG[number]["key"];

export function normalizeSocialUrl(key: SocialKey, value: string): string {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  const cfg = SOCIAL_CONFIG.find((c) => c.key === key);
  if (!cfg || !cfg.base) return value;
  const handle = value.startsWith("@") ? value.slice(1) : value;
  return `${cfg.base}${handle}`;
}

export function SocialLinks({ profile }: { profile: ProfileRow }) {
  const links = SOCIAL_CONFIG
    .map((cfg) => {
      const raw = profile[cfg.key] as string | null | undefined;
      const url = raw ? normalizeSocialUrl(cfg.key, raw) : "";
      return url ? { ...cfg, url } : null;
    })
    .filter(Boolean) as Array<{ key: SocialKey; label: string; emoji: string; url: string }>;

  if (links.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.key}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium hover:bg-muted/70 transition-colors"
        >
          <span>{l.emoji}</span>
          <span>{l.label}</span>
        </a>
      ))}
    </div>
  );
}

export { SOCIAL_CONFIG };
export type { SocialKey };
```

- [ ] **Step 2: Commit**

```bash
git add src/components/profile/SocialLinks.tsx
git commit -m "feat: SocialLinks component + normalizeSocialUrl util"
```

---

## Task 8: PublicCard.tsx

**Files:**
- Create: `src/components/profile/PublicCard.tsx`

- [ ] **Step 1: Crear componente**

```tsx
import { QRCodeSVG } from "qrcode.react";
import { UserCircle } from "lucide-react";
import { SocialLinks, normalizeSocialUrl } from "@/components/profile/SocialLinks";
import type { ProfileRow } from "@/data/profileApi";

interface PublicCardProps {
  profile: ProfileRow;
  publicUrl: string;
  compact?: boolean;
}

function ContactRow({ emoji, value, href }: { emoji: string; value: string; href?: string }) {
  const content = (
    <div className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 grid place-items-center text-base flex-shrink-0">
        {emoji}
      </div>
      <span className="text-sm text-gray-700 truncate">{value}</span>
    </div>
  );
  if (href) {
    return <a href={href} target="_blank" rel="noreferrer" className="block hover:bg-gray-50 rounded-lg px-1 transition-colors">{content}</a>;
  }
  return <div className="px-1">{content}</div>;
}

function generateVCard(profile: ProfileRow): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${profile.full_name ?? ""}`,
    `EMAIL:${profile.email ?? ""}`,
    profile.phone_mobile ? `TEL;TYPE=CELL:${profile.phone_mobile}` : "",
    profile.phone_office ? `TEL;TYPE=WORK:${profile.phone_office}` : "",
    profile.whatsapp ? `TEL;TYPE=CELL,PREF:${profile.whatsapp}` : "",
    profile.office_address ? `ADR:;;${profile.office_address};;;;` : "",
    profile.website ? `URL:${normalizeSocialUrl("website", profile.website)}` : "",
    profile.linkedin ? `URL;TYPE=linkedin:${normalizeSocialUrl("linkedin", profile.linkedin)}` : "",
    "END:VCARD",
  ].filter(Boolean);
  return lines.join("\n");
}

export function downloadVCard(profile: ProfileRow) {
  const vcf = generateVCard(profile);
  const blob = new Blob([vcf], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(profile.full_name ?? "contacto").replace(/\s+/g, "-").toLowerCase()}.vcf`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PublicCard({ profile, publicUrl, compact = false }: PublicCardProps) {
  const whatsappNum = (profile.whatsapp ?? profile.phone_mobile ?? "").replace(/\D/g, "");

  return (
    <div className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden shadow-xl">
      {/* HERO */}
      <div style={{ background: "linear-gradient(130deg, #6e0709 0%, #E21013 100%)" }} className="p-5 flex gap-4 items-center">
        <div className="w-20 h-20 rounded-full border-2 border-yellow-400 bg-yellow-400/15 overflow-hidden grid place-items-center flex-shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name ?? ""} className="w-full h-full object-cover" />
          ) : (
            <UserCircle className="h-10 w-10 text-yellow-400" />
          )}
        </div>
        <div className="text-white min-w-0">
          <div className="font-bold text-lg leading-tight truncate" style={{ fontFamily: "Georgia, serif" }}>
            {profile.full_name ?? "Agente"}
          </div>
          {profile.bio && <div className="text-white/70 text-xs mt-1 line-clamp-2">{profile.bio}</div>}
          <div className="mt-2 inline-flex items-center gap-1.5 bg-yellow-500/20 border border-yellow-400 rounded-full px-3 py-1 text-yellow-300 text-[11px] font-semibold">
            🏅 Agente Autorizado Salgon
          </div>
        </div>
      </div>

      {/* DATOS */}
      <div className="bg-white px-4 py-1">
        {profile.phone_mobile && (
          <ContactRow emoji="📱" value={profile.phone_mobile}
            href={whatsappNum ? `https://wa.me/${whatsappNum}` : undefined} />
        )}
        {profile.phone_office && <ContactRow emoji="📞" value={profile.phone_office} href={`tel:${profile.phone_office}`} />}
        {profile.email && <ContactRow emoji="✉" value={profile.email} href={`mailto:${profile.email}`} />}
        {profile.office_address && <ContactRow emoji="📍" value={profile.office_address} />}
        {/* Redes sociales */}
        <div className="py-3 border-b border-gray-100">
          <SocialLinks profile={profile} />
        </div>
      </div>

      {/* FOOTER */}
      {!compact && (
        <div style={{ background: "linear-gradient(90deg, #6e0709, #991012)" }} className="px-4 py-3 flex items-center justify-between">
          <span className="text-yellow-400 font-bold text-sm">★ Salgon Bienes Raíces</span>
          <QRCodeSVG value={publicUrl} size={48} bgColor="transparent" fgColor="#fff" />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
bun run tsc --noEmit 2>&1 | grep PublicCard || echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/PublicCard.tsx
git commit -m "feat: PublicCard component (design B, #E21013, QR, vCard)"
```

---

## Task 9: Ruta `/p/$id` — Tarjeta pública

**Files:**
- Create: `src/routes/p.$id.tsx`

- [ ] **Step 1: Crear la ruta**

```tsx
import { createFileRoute, notFound } from "@tanstack/react-router";
import { PublicCard, downloadVCard } from "@/components/profile/PublicCard";
import { usePublicProfile } from "@/data/profileApi";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/p/$id")({
  component: PublicCardPage,
});

const BASE_URL = "https://app.salgon.com";

function PublicCardPage() {
  const { id } = Route.useParams();
  const { data: profile, isLoading } = usePublicProfile(id);

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="animate-pulse text-sm text-gray-400">Cargando…</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="text-4xl mb-4">🏠</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Perfil no encontrado</h1>
          <p className="text-sm text-gray-500">Este enlace no corresponde a ningún agente.</p>
        </div>
      </div>
    );
  }

  const publicUrl = `${BASE_URL}/p/${id}`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8 gap-4">
      <PublicCard profile={profile} publicUrl={publicUrl} />
      <Button
        variant="outline"
        className="gap-2 w-full max-w-sm"
        onClick={() => downloadVCard(profile)}
      >
        <Download className="h-4 w-4" />
        Guardar contacto
      </Button>
      <p className="text-xs text-gray-400 text-center">
        Compartir: <span className="font-mono">{publicUrl}</span>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Regenerar routeTree**

```bash
bun run dev &
sleep 8
kill %1 2>/dev/null || true
```

Verificar que `src/routeTree.gen.ts` incluye `/p/$id`.

- [ ] **Step 3: Verificar compilación**

```bash
bun run tsc --noEmit 2>&1 | grep "p\.\$id" || echo "OK"
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/p.\$id.tsx src/routeTree.gen.ts
git commit -m "feat: public card route /p/:id"
```

---

## Task 10: ProfileForm.tsx

**Files:**
- Create: `src/components/profile/ProfileForm.tsx`

- [ ] **Step 1: Crear componente**

```tsx
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AvatarInput } from "@/components/profile/AvatarInput";
import { PublicCard } from "@/components/profile/PublicCard";
import { SOCIAL_CONFIG, normalizeSocialUrl } from "@/components/profile/SocialLinks";
import { useUpdateProfile, type ProfileRow, type ProfileUpdate } from "@/data/profileApi";
import { cn } from "@/lib/utils";
import type { SocialKey } from "@/components/profile/SocialLinks";

const phoneRegex = /^[+\d\s().-]{7,25}$/;

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Mínimo 2 caracteres").max(100),
  bio: z.string().trim().max(160, "Máximo 160 caracteres").default(""),
  avatar_url: z.string().trim().max(500).default(""),
  phone_mobile: z.string().trim().regex(phoneRegex, "Teléfono inválido").or(z.literal("")).default(""),
  phone_office: z.string().trim().regex(phoneRegex, "Teléfono inválido").or(z.literal("")).default(""),
  whatsapp: z.string().trim().regex(phoneRegex, "Teléfono inválido").or(z.literal("")).default(""),
  office_address: z.string().trim().max(200).default(""),
  instagram: z.string().trim().max(200).default(""),
  facebook: z.string().trim().max(200).default(""),
  linkedin: z.string().trim().max(200).default(""),
  tiktok: z.string().trim().max(200).default(""),
  twitter_x: z.string().trim().max(200).default(""),
  youtube: z.string().trim().max(200).default(""),
  website: z.string().trim().max(200).default(""),
});

type ProfileForm = z.infer<typeof profileSchema>;

function toForm(p: ProfileRow): ProfileForm {
  return {
    full_name: p.full_name ?? "",
    bio: p.bio ?? "",
    avatar_url: p.avatar_url ?? "",
    phone_mobile: p.phone_mobile ?? "",
    phone_office: p.phone_office ?? "",
    whatsapp: p.whatsapp ?? "",
    office_address: p.office_address ?? "",
    instagram: p.instagram ?? "",
    facebook: p.facebook ?? "",
    linkedin: p.linkedin ?? "",
    tiktok: p.tiktok ?? "",
    twitter_x: p.twitter_x ?? "",
    youtube: p.youtube ?? "",
    website: p.website ?? "",
  };
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface ProfileFormProps {
  profile: ProfileRow;
  publicUrl: string;
}

export function ProfileForm({ profile, publicUrl }: ProfileFormProps) {
  const update = useUpdateProfile();
  const [form, setForm] = useState<ProfileForm>(toForm(profile));
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileForm, string>>>({});

  function set<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const fe: Partial<Record<keyof ProfileForm, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof ProfileForm;
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      toast.error(parsed.error.issues[0].message);
      return;
    }
    // Normalize social URLs before saving
    const patch: ProfileUpdate = {
      ...parsed.data,
      instagram: normalizeSocialUrl("instagram", parsed.data.instagram),
      facebook: normalizeSocialUrl("facebook", parsed.data.facebook),
      linkedin: normalizeSocialUrl("linkedin", parsed.data.linkedin),
      tiktok: normalizeSocialUrl("tiktok", parsed.data.tiktok),
      twitter_x: normalizeSocialUrl("twitter_x", parsed.data.twitter_x),
      youtube: normalizeSocialUrl("youtube", parsed.data.youtube),
    };
    try {
      await update.mutateAsync({ id: profile.id, patch });
      toast.success("Perfil guardado");
    } catch (err) {
      const e = err as { message?: string };
      toast.error(e.message ?? "No se pudo guardar");
    }
  }

  // Build a preview profile merging current form values
  const previewProfile: ProfileRow = {
    ...profile,
    ...form,
    full_name: form.full_name || profile.full_name,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Mis datos</TabsTrigger>
          <TabsTrigger value="redes">Redes sociales</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="space-y-4 pt-4">
          <Field label="Foto de perfil">
            <AvatarInput value={form.avatar_url} onChange={(v) => set("avatar_url", v)} userId={profile.id} />
          </Field>
          <Field label="Nombre completo *" error={errors.full_name}>
            <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} maxLength={100} />
          </Field>
          <Field label="Bio / tagline" error={errors.bio}>
            <Textarea rows={2} value={form.bio} onChange={(e) => set("bio", e.target.value)}
              placeholder="Ej. Especialista en residencial de lujo en Monterrey" maxLength={160} />
            <p className="text-[11px] text-muted-foreground text-right">{form.bio.length}/160</p>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Celular" error={errors.phone_mobile}>
              <Input type="tel" value={form.phone_mobile} onChange={(e) => set("phone_mobile", e.target.value)} placeholder="+52 81 1234 5678" maxLength={25} />
            </Field>
            <Field label="Teléfono fijo" error={errors.phone_office}>
              <Input type="tel" value={form.phone_office} onChange={(e) => set("phone_office", e.target.value)} placeholder="+52 81 8765 4321" maxLength={25} />
            </Field>
            <Field label="WhatsApp" error={errors.whatsapp}>
              <Input type="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+52 81 1234 5678" maxLength={25} />
            </Field>
            <Field label="Email">
              <Input value={profile.email ?? ""} readOnly className="opacity-60 cursor-not-allowed" />
            </Field>
          </div>
          <Field label="Dirección de oficina">
            <Input value={form.office_address} onChange={(e) => set("office_address", e.target.value)} placeholder="Av. Vasconcelos 123, Of. 4, Monterrey" maxLength={200} />
          </Field>
        </TabsContent>

        <TabsContent value="redes" className="space-y-4 pt-4">
          <p className="text-xs text-muted-foreground">Puedes poner la URL completa o tu @usuario.</p>
          {SOCIAL_CONFIG.map((cfg) => (
            <Field key={cfg.key} label={`${cfg.emoji} ${cfg.label}`}>
              <Input
                value={form[cfg.key as SocialKey] as string}
                onChange={(e) => set(cfg.key as SocialKey, e.target.value)}
                placeholder={cfg.key === "website" ? "https://tusitioweb.com" : `@tuusuario o URL`}
                maxLength={200}
              />
            </Field>
          ))}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button type="submit" disabled={update.isPending}>
          {update.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
          Guardar cambios
        </Button>
      </div>

      {/* Preview */}
      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Vista previa de tu tarjeta</p>
        <PublicCard profile={previewProfile} publicUrl={publicUrl} compact />
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
bun run tsc --noEmit 2>&1 | grep ProfileForm || echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/ProfileForm.tsx
git commit -m "feat: ProfileForm component (2-tab edit + live preview)"
```

---

## Task 11: Ruta `/profile`

**Files:**
- Create: `src/routes/profile.tsx`

- [ ] **Step 1: Crear la ruta**

```tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageCard } from "@/components/common/PageCard";
import { Button } from "@/components/ui/button";
import { ExternalLink, Copy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/data/profileApi";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { toast } from "sonner";
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary title="Mi Perfil" error={error} reset={reset} />
  ),
});

const BASE_URL = "https://app.salgon.com";

function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile(user?.id);

  if (!user) {
    navigate({ to: "/auth" });
    return null;
  }

  const publicUrl = `${BASE_URL}/p/${user.id}`;

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(() => toast.success("Enlace copiado"));
  }

  return (
    <AppShell title="Mi Perfil" subtitle="Edita tu información y tarjeta digital">
      <PageCard
        title="Mi Perfil"
        description="Tu información pública como agente Salgon"
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={copyLink}>
              <Copy className="h-3.5 w-3.5" /> Copiar enlace
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Ver tarjeta
              </a>
            </Button>
          </div>
        }
      >
        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Cargando perfil…</div>
        ) : profile ? (
          <ProfileForm profile={profile} publicUrl={publicUrl} />
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">No se encontró tu perfil.</div>
        )}
      </PageCard>
    </AppShell>
  );
}
```

- [ ] **Step 2: Regenerar routeTree (si no se hizo en Task 9)**

```bash
bun run dev &
sleep 8
kill %1 2>/dev/null || true
```

- [ ] **Step 3: Verificar compilación**

```bash
bun run tsc --noEmit 2>&1 | grep "routes/profile" || echo "OK"
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/profile.tsx src/routeTree.gen.ts
git commit -m "feat: /profile route (edit own profile)"
```

---

## Task 12: Topbar — dropdown en avatar

**Files:**
- Modify: `src/components/layout/Topbar.tsx`

- [ ] **Step 1: Reemplazar área de avatar con DropdownMenu**

Reemplazar el contenido completo de `src/components/layout/Topbar.tsx`:

```tsx
import { Bell, Search, LogOut, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { CommandPalette } from "@/components/layout/CommandPalette";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { profile, user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Usuario";
  const initials = displayName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const roleLabel = roles.includes("admin") ? "Administrador" : roles.includes("agent") ? "Agente" : "Sin rol";

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  async function handleSignOut() {
    await signOut();
    toast.success("Sesión cerrada");
  }

  return (
    <>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4 px-6 h-16">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="relative hidden md:flex items-center h-9 w-72 rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted/80 transition-colors"
            >
              <Search className="mr-2 h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">Buscar propiedades, prospectos…</span>
              <kbd className="hidden lg:inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/60 bg-background ml-2">
                ⌘K
              </kbd>
            </button>
            <button className="relative h-9 w-9 grid place-items-center rounded-full hover:bg-muted">
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-gold" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 pl-2 border-l border-border focus:outline-none">
                  <Avatar className="h-8 w-8">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={displayName} />}
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block leading-tight text-left">
                    <div className="text-sm font-medium">{displayName}</div>
                    <div className="text-[11px] text-muted-foreground">{roleLabel}</div>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                  <User className="h-4 w-4 mr-2" /> Mi perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}
```

- [ ] **Step 2: Verificar compilación**

```bash
bun run tsc --noEmit 2>&1 | grep Topbar || echo "OK"
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Topbar.tsx
git commit -m "feat: Topbar avatar → DropdownMenu (Mi perfil + Cerrar sesión)"
```

---

## Task 13: Sidebar — añadir Mi Perfil

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Añadir User import y enlace de perfil**

En `src/components/layout/Sidebar.tsx`, añadir `User` al import de lucide-react y añadir el ítem de Mi Perfil en el bloque del footer, antes de Configuración:

```tsx
// Cambiar import de lucide (añadir User):
import {
  LayoutDashboard, Building2, Users, CalendarDays, KanbanSquare,
  MessageCircle, UserCog, Settings, LogOut, ClipboardList, BarChart3,
  Newspaper, Ticket, User,
} from "lucide-react";
```

En el bloque `<div className="border-t border-sidebar-border p-3 space-y-1">`, añadir antes de Configuración:

```tsx
<Link
  to="/profile"
  className={cn(
    "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
    pathname === "/profile"
      ? "bg-sidebar-accent text-sidebar-primary font-medium"
      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60"
  )}
>
  <User className="h-4 w-4" /> Mi Perfil
</Link>
```

- [ ] **Step 2: Verificar compilación**

```bash
bun run tsc --noEmit 2>&1 | grep Sidebar || echo "OK"
```

- [ ] **Step 3: Build y deploy final**

```bash
bun run build 2>&1 | tail -3
powershell -Command "(Get-Content dist/server/wrangler.json) -replace '\"workers_dev\":false', '\"workers_dev\":true' | Set-Content dist/server/wrangler.json"
npx wrangler deploy 2>&1 | tail -5
```

- [ ] **Step 4: Commit final**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: Sidebar añade ítem Mi Perfil"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Task 2: 13 columnas migradas + RLS SELECT anon + UPDATE own
- ✅ Task 3: bucket `avatars` público con RLS
- ✅ Task 5: `useProfile`, `useUpdateProfile`, `usePublicProfile`
- ✅ Task 6: `SocialLinks` + `normalizeSocialUrl` (handle → URL)
- ✅ Task 7: `AvatarInput` (upload avatars bucket + URL)
- ✅ Task 8: `PublicCard` diseño B · `#E21013` · QR · `downloadVCard`
- ✅ Task 9: `/p/$id` pública, 404 si no existe
- ✅ Task 10: `ProfileForm` 2 tabs + preview en tiempo real
- ✅ Task 11: `/profile` con botones "Copiar enlace" y "Ver tarjeta"
- ✅ Task 12: Topbar DropdownMenu con Mi Perfil + Cerrar sesión
- ✅ Task 13: Sidebar ítem Mi Perfil
- ✅ `qrcode.react` instalado en Task 1
- ✅ `slug` columna creada (sin UI — fuera de alcance explícito)

**Placeholder scan:** Ninguno encontrado — cada step tiene código completo.

**Type consistency:** `ProfileRow` definido en `profileApi.ts` (Task 5) y usado en Tasks 6–11. `ProfileUpdate` = `TablesUpdate<"profiles">`. `SocialKey` exportado de `SocialLinks.tsx` y usado en `ProfileForm.tsx`.
