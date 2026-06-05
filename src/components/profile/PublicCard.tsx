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
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block hover:bg-gray-50 rounded-lg px-1 transition-colors">
        {content}
      </a>
    );
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
        <div className="py-3 border-b border-gray-100 last:border-0">
          <SocialLinks profile={profile} />
        </div>
      </div>

      {/* FOOTER */}
      {!compact && (
        <div style={{ background: "linear-gradient(90deg, #6e0709, #991012)" }} className="px-4 py-3 flex items-center justify-between">
          <span className="text-yellow-400 font-bold text-sm">★ Salgon Bienes Raíces</span>
          <div className="bg-white rounded-lg p-1.5">
            <QRCodeSVG value={publicUrl} size={44} bgColor="#ffffff" fgColor="#111111" />
          </div>
        </div>
      )}
    </div>
  );
}
