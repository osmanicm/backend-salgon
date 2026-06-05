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
import { SOCIAL_CONFIG, normalizeSocialUrl, type SocialKey } from "@/components/profile/SocialLinks";
import { useUpdateProfile, type ProfileRow, type ProfileUpdate } from "@/data/profileApi";

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

type ProfileFormValues = z.infer<typeof profileSchema>;

function toForm(p: ProfileRow): ProfileFormValues {
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
  const [form, setForm] = useState<ProfileFormValues>(toForm(profile));
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileFormValues, string>>>({});

  function set<K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      const fe: Partial<Record<keyof ProfileFormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof ProfileFormValues;
        if (k && !fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      toast.error(parsed.error.issues[0].message);
      return;
    }
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

  // Preview profile merges current form values over the saved profile
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
                value={form[cfg.key as SocialKey]}
                onChange={(e) => set(cfg.key as SocialKey, e.target.value)}
                placeholder={cfg.key === "website" ? "https://tusitioweb.com" : "@tuusuario o URL"}
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
