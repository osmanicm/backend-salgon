import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { z } from "zod";
import { CalendarDays, CheckCircle2, Clock, Loader2, MapPin, Ticket, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchPublicEvent, useGuestRegister, GUEST_ERRORS } from "@/data/publicEventsApi";
import {
  TurnstileWidget,
  TURNSTILE_SITE_KEY,
  type TurnstileStatus,
} from "@/components/common/TurnstileWidget";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { cn } from "@/lib/utils";

/** Dominio público: las URLs de Open Graph tienen que ser absolutas. */
const SITE_URL = "https://app.salgon.com";

/** Recorta la descripción para la vista previa sin cortar a media palabra. */
function preview(text: string, max = 180) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(" ", max);
  return clean.slice(0, cut > 0 ? cut : max) + "…";
}

function absoluteImage(url: string | null | undefined): string | null {
  const normalized = normalizeImageUrl(url ?? "");
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return `${SITE_URL}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
}

export const Route = createFileRoute("/e/$id")({
  // El loader corre en el servidor en la primera carga, así que el HTML sale con
  // el evento dentro: es lo que leen WhatsApp, Facebook y los buscadores.
  loader: async ({ params }) => ({ event: await fetchPublicEvent(params.id) }),
  head: ({ loaderData, params }) => {
    const ev = loaderData?.event ?? null;
    const url = `${SITE_URL}/e/${params.id}`;

    if (!ev) {
      const title = "Evento no disponible · Inmobiliaria Salgon";
      return {
        meta: [
          { title },
          { name: "robots", content: "noindex" },
          { property: "og:title", content: title },
          { property: "og:url", content: url },
        ],
      };
    }

    const when = ev.starts_at
      ? new Date(ev.starts_at).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })
      : null;
    const title = `${ev.title} · Inmobiliaria Salgon`;
    const description = preview(
      ev.description || [when, ev.location].filter(Boolean).join(" · ") || "Evento de Inmobiliaria Salgon",
    );
    const image = absoluteImage(ev.image_url);

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:site_name", content: "Inmobiliaria Salgon" },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
    };
  },
  component: PublicEventPage,
});

const guestSchema = z.object({
  guest_name: z.string().trim().min(2, "Escribe tu nombre completo").max(100),
  guest_email: z.string().trim().email("Correo inválido").max(255),
  guest_phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(500).optional(),
});

function fmtLong(d?: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" });
}

function fmtSlot(d: string) {
  return new Date(d).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function PublicEventPage() {
  const { event: ev } = Route.useLoaderData();
  const register = useGuestRegister();

  const [form, setForm] = useState({ guest_name: "", guest_email: "", guest_phone: "", notes: "" });
  const [slotId, setSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Anti-spam: campo trampa, cronómetro desde que se montó la página y token del captcha.
  const [honeypot, setHoneypot] = useState("");
  const mountedAt = useRef(Date.now());
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileStatus, setTurnstileStatus] = useState<TurnstileStatus>("loading");
  const handleToken = useCallback((t: string) => setTurnstileToken(t), []);
  const handleStatus = useCallback((s: TurnstileStatus) => setTurnstileStatus(s), []);

  if (!ev) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 px-4">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🎟️</div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Evento no disponible</h1>
          <p className="text-sm text-gray-500">
            Este enlace no corresponde a ningún evento publicado. Puede que haya terminado o que aún
            no esté abierto al público.
          </p>
        </div>
      </div>
    );
  }

  const img = normalizeImageUrl(ev.image_url ?? "");
  const slots = ev.slots ?? [];
  const when = fmtLong(ev.starts_at);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = guestSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError(
        turnstileStatus === "error"
          ? "No pudimos cargar la verificación de seguridad. Desactiva el bloqueador de anuncios o recarga la página; si sigue igual, escríbenos por WhatsApp."
          : "Espera a que termine la verificación de seguridad y vuelve a intentarlo.",
      );
      return;
    }
    try {
      await register.mutateAsync({
        event_id: ev!.id,
        slot_id: slotId,
        guest_name: parsed.data.guest_name,
        guest_email: parsed.data.guest_email,
        guest_phone: parsed.data.guest_phone,
        notes: parsed.data.notes,
        website: honeypot,
        elapsed_ms: Date.now() - mountedAt.current,
        turnstile_token: turnstileToken,
      });
      setDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes(GUEST_ERRORS.DUPLICATE)) {
        setError("Ya recibimos una solicitud con ese correo para este evento.");
      } else if (msg.includes(GUEST_ERRORS.REJECTED)) {
        setError("No pudimos verificar que seas una persona. Recarga la página e inténtalo de nuevo.");
      } else if (msg.includes(GUEST_ERRORS.EVENT)) {
        setError("Este evento ya no está disponible.");
      } else {
        setError("No pudimos enviar tu solicitud. Inténtalo de nuevo en un momento.");
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-2">
          <img src="/salgon-logo.png" alt="Salgon" className="h-8 w-8 rounded-lg object-cover" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-gray-900">Inmobiliaria Salgon</div>
            <div className="text-[11px] text-gray-500">Bienes Raíces</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5 space-y-4">
        <article className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          {img && <img src={img} alt={ev.title} className="w-full h-48 sm:h-60 object-cover" />}
          <div className="p-5 space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
              <Ticket className="h-3.5 w-3.5" /> {ev.type}
            </span>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900">{ev.title}</h1>

            <div className="space-y-1.5 text-sm text-gray-600">
              {when && (
                <div className="flex items-start gap-2">
                  <CalendarDays className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                  <span className="first-letter:uppercase">{when}</span>
                </div>
              )}
              {ev.location && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                  <span>{ev.location}</span>
                </div>
              )}
              {ev.capacity != null && (
                <div className="flex items-start gap-2">
                  <Users className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                  <span>Cupo limitado: {ev.capacity} lugares</span>
                </div>
              )}
            </div>

            {ev.description && (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed pt-1">
                {ev.description}
              </p>
            )}
          </div>
        </article>

        {done ? (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-600" />
            <h2 className="text-base font-semibold text-emerald-900">Solicitud enviada</h2>
            <p className="text-sm text-emerald-800">
              Inmobiliaria Salgon revisará tu solicitud y te confirmará tu lugar por correo. Tu
              registro queda <strong>pendiente de aprobación</strong> hasta entonces.
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">Apártame un lugar</h2>
            <p className="text-xs text-gray-500 mt-0.5 mb-4">
              Déjanos tus datos. Tu registro pasa por el proceso de aprobación de Inmobiliaria
              Salgon y te confirmamos por correo.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="guest-name">Nombre completo *</Label>
                <Input
                  id="guest-name"
                  value={form.guest_name}
                  onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
                  placeholder="Tu nombre"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guest-email">Correo *</Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={form.guest_email}
                  onChange={(e) => setForm({ ...form, guest_email: e.target.value })}
                  placeholder="tucorreo@ejemplo.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="guest-phone">Teléfono (opcional)</Label>
                <Input
                  id="guest-phone"
                  value={form.guest_phone}
                  onChange={(e) => setForm({ ...form, guest_phone: e.target.value })}
                  placeholder="+52 993 000 0000"
                />
              </div>

              {slots.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Elige un horario</Label>
                  <div className="grid gap-2">
                    {slots.map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => setSlotId(slotId === s.id ? null : s.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          slotId === s.id
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-gray-200 hover:bg-gray-50 text-gray-700",
                        )}
                      >
                        <Clock className="h-4 w-4 shrink-0" />
                        <span className="flex-1 min-w-0">
                          {s.label ? `${s.label} · ` : ""}
                          {fmtSlot(s.starts_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="guest-notes">¿Algo que debamos saber? (opcional)</Label>
                <Textarea
                  id="guest-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder="Cuántas personas te acompañan, dudas, etc."
                />
              </div>

              {/* Campo trampa: fuera de pantalla y fuera del recorrido de tabulación.
                  Solo lo llena un bot que rellena todos los inputs del formulario. */}
              <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="website">No llenar</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </div>

              <TurnstileWidget onToken={handleToken} onStatus={handleStatus} />
              {turnstileStatus === "error" && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  No pudimos cargar la verificación de seguridad. Desactiva el bloqueador de anuncios
                  o recarga la página para poder enviar tu solicitud.
                </p>
              )}

              {error && (
                <p role="alert" className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" className="w-full gap-1.5" disabled={register.isPending}>
                {register.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar solicitud
              </Button>
            </form>
          </section>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">¿Quieres tu cuenta en Salgon?</h2>
          <p className="text-sm text-gray-600 mt-1">
            Con una cuenta ves el inventario, los eventos y tus citas desde tu teléfono. Al
            registrarte, tu cuenta entra al <strong>proceso de aprobación de Inmobiliaria
            Salgon</strong>: un administrador la revisa y la activa antes de que puedas entrar.
          </p>
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link to="/auth">Crear mi cuenta</Link>
          </Button>
        </section>

        <p className="text-[11px] text-gray-400 text-center pb-6">
          Inmobiliaria Salgon · Tus datos se usan solo para gestionar tu asistencia.{" "}
          <Link to="/aviso-de-privacidad" className="underline">
            Aviso de Privacidad
          </Link>
        </p>
      </main>
    </div>
  );
}
