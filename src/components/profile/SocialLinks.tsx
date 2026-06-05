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
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
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
