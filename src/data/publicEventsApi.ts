import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { registerEventGuest, GUEST_ERRORS } from "@/utils/publicEvents.functions";
import type { EventRow } from "./eventsApi";

/**
 * Evento de la página pública (/e/{id}), consultado SIN sesión. La RLS de
 * `events` y `event_slots` deja leer a `anon` solo lo publicado, así que un
 * borrador devuelve null igual que un id inexistente.
 *
 * Lo llama el `loader` de la ruta, que corre también en el servidor: así el HTML
 * sale ya con el contenido y las etiquetas Open Graph para las vistas previas de
 * WhatsApp y redes.
 */
export async function fetchPublicEvent(id: string): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from("events")
    .select("*, slots:event_slots(*)")
    .eq("id", id)
    .eq("status", "Published")
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as EventRow | null) ?? null;
}

export { GUEST_ERRORS };

export interface GuestRegistrationInput {
  event_id: string;
  slot_id?: string | null;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  notes?: string;
  /** Campo trampa para bots: el visitante nunca lo ve. */
  website?: string;
  /** Cuánto tardó en enviar desde que cargó la página. */
  elapsed_ms: number;
  turnstile_token?: string;
}

/**
 * El alta va por una server function (no directo a Supabase) para poder filtrar
 * bots antes de escribir; ver src/utils/publicEvents.functions.ts.
 */
export function useGuestRegister() {
  return useMutation({
    mutationFn: async (input: GuestRegistrationInput) => {
      await registerEventGuest({
        data: {
          event_id: input.event_id,
          slot_id: input.slot_id ?? null,
          guest_name: input.guest_name.trim(),
          guest_email: input.guest_email.trim(),
          guest_phone: input.guest_phone?.trim() ?? "",
          notes: input.notes?.trim() ?? "",
          website: input.website ?? "",
          elapsed_ms: input.elapsed_ms,
          turnstile_token: input.turnstile_token ?? "",
        },
      });
    },
  });
}
