import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Registro de invitados desde la página pública del evento (/e/{id}).
 *
 * Pasa por el servidor —y no directo a Supabase— para poder filtrar bots antes
 * de escribir. Tres capas, de la más barata a la más cara:
 *   1. Honeypot: un campo que el CSS esconde y un humano nunca llena.
 *   2. Tiempo mínimo de llenado: los bots envían el formulario al instante.
 *   3. Turnstile (captcha de Cloudflare), si hay clave secreta configurada.
 *
 * La escritura usa la llave de servicio, así que aquí se revalida TODO lo que
 * antes garantizaba la RLS: el evento existe y está publicado, el horario es
 * de ese evento, el estatus nace "Pending" y nunca se asocia a un usuario.
 */

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Un humano no llena un formulario así de rápido. */
const MIN_FILL_MS = 3000;

export const GUEST_ERRORS = {
  DUPLICATE: "DUPLICATE_GUEST",
  REJECTED: "SPAM_REJECTED",
  EVENT: "EVENT_NOT_AVAILABLE",
} as const;

const GuestSchema = z.object({
  event_id: z.string().uuid(),
  slot_id: z.string().uuid().nullable().optional(),
  guest_name: z.string().trim().min(2).max(100),
  guest_email: z.string().trim().email().max(255),
  guest_phone: z.string().trim().max(30).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
  /** Campo trampa: si trae algo, es un bot. */
  website: z.string().max(200).optional().default(""),
  /** Milisegundos que el visitante tardó en enviar desde que cargó la página. */
  elapsed_ms: z.number().int().nonnegative(),
  turnstile_token: z.string().max(4096).optional().default(""),
});

async function passesTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Sin clave configurada no hay captcha que validar (desarrollo o despliegue
  // aún sin Turnstile): quedan el honeypot y el tiempo mínimo.
  if (!secret) return true;
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body });
  if (!res.ok) return false;
  const json = (await res.json()) as { success?: boolean };
  return json.success === true;
}

export const registerEventGuest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => GuestSchema.parse(d))
  .handler(async ({ data }) => {
    const ip = getRequest()?.headers.get("CF-Connecting-IP") ?? null;

    if (data.website.trim() !== "" || data.elapsed_ms < MIN_FILL_MS) {
      throw new Error(GUEST_ERRORS.REJECTED);
    }
    if (!(await passesTurnstile(data.turnstile_token, ip))) {
      throw new Error(GUEST_ERRORS.REJECTED);
    }

    // La llave de servicio ignora la RLS: revalidamos evento y horario a mano.
    const { data: ev, error: evErr } = await supabaseAdmin
      .from("events")
      .select("id, status")
      .eq("id", data.event_id)
      .maybeSingle();
    if (evErr) throw evErr;
    if (!ev || ev.status !== "Published") throw new Error(GUEST_ERRORS.EVENT);

    if (data.slot_id) {
      const { data: slot, error: slotErr } = await supabaseAdmin
        .from("event_slots")
        .select("id")
        .eq("id", data.slot_id)
        .eq("event_id", data.event_id)
        .maybeSingle();
      if (slotErr) throw slotErr;
      if (!slot) throw new Error(GUEST_ERRORS.EVENT);
    }

    const { error } = await supabaseAdmin.from("event_registrations").insert({
      event_id: data.event_id,
      slot_id: data.slot_id ?? null,
      user_id: null,
      status: "Pending",
      guest_name: data.guest_name,
      guest_email: data.guest_email.toLowerCase(),
      guest_phone: data.guest_phone || null,
      notes: data.notes,
    });

    if (error) {
      // 23505 = índice único (event_id, lower(guest_email)).
      if (error.code === "23505") throw new Error(GUEST_ERRORS.DUPLICATE);
      throw error;
    }

    return { ok: true };
  });
