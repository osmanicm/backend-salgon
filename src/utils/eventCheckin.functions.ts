import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, emailLayout, emailButton } from "./mailer.server";

/**
 * Check-in de eventos.
 *
 * Cada inscripción tiene un `checkin_token` secreto. El QR del asistente apunta
 * a /checkin/{token}: abrirlo (lo escanee el personal o lo toque el propio
 * invitado) marca la entrada. Todo corre en el servidor con la llave de
 * servicio, así que aquí se revalida lo que la RLS no puede saber: que la
 * inscripción esté aprobada y que estemos dentro del horario del evento.
 */

const SITE_URL = process.env.SITE_URL || "https://app.salgon.com";

/** Cuánto antes y después del evento se acepta marcar entrada. */
const WINDOW_BEFORE_MS = 3 * 60 * 60 * 1000;
const WINDOW_AFTER_MS = 3 * 60 * 60 * 1000;

export type CheckinReason =
  | "ok"
  | "already"
  | "not_found"
  | "pending"
  | "cancelled"
  | "outside_window";

export interface PassEvent {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string;
}

export interface PassInfo {
  found: boolean;
  name: string;
  status: "Pending" | "Confirmed" | "Attended" | "Cancelled" | null;
  checkedInAt: string | null;
  event: PassEvent | null;
}

export interface CheckinResult extends PassInfo {
  reason: CheckinReason;
  /** false cuando el correo de bienvenida no pudo salir (Resend sin dominio, etc.). */
  emailSent: boolean;
  /** Si ya tiene cuenta en la app, no se le invita a registrarse (ni en pantalla ni por correo). */
  hasAccount: boolean;
}

const SELECT =
  "id, status, checked_in_at, guest_name, guest_email, user_id, event:events!event_registrations_event_id_fkey(id, title, starts_at, ends_at, location)";

interface RegRow {
  id: string;
  status: "Pending" | "Confirmed" | "Attended" | "Cancelled";
  checked_in_at: string | null;
  guest_name: string | null;
  guest_email: string | null;
  user_id: string | null;
  event: PassEvent | null;
}

async function loadByToken(token: string): Promise<RegRow | null> {
  const { data, error } = await supabaseAdmin
    .from("event_registrations")
    .select(SELECT)
    .eq("checkin_token", token)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as RegRow | null) ?? null;
}

/** Nombre y correo del asistente: de los campos de invitado o de su perfil. */
async function identify(reg: RegRow): Promise<{ name: string; email: string | null }> {
  if (reg.user_id) {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", reg.user_id)
      .maybeSingle();
    return {
      name: data?.full_name || data?.email?.split("@")[0] || "Invitado",
      email: data?.email ?? null,
    };
  }
  return { name: reg.guest_name || "Invitado", email: reg.guest_email };
}

/** ¿Ese correo ya tiene cuenta en la app? Decide si se invita a registrarse. */
async function hasAppAccount(email: string | null): Promise<boolean> {
  if (!email) return false;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return !!data;
}

function insideWindow(ev: PassEvent | null): boolean {
  // Sin fecha no hay ventana que aplicar: se acepta.
  if (!ev?.starts_at) return true;
  const start = new Date(ev.starts_at).getTime();
  const end = ev.ends_at ? new Date(ev.ends_at).getTime() : start;
  const now = Date.now();
  return now >= start - WINDOW_BEFORE_MS && now <= end + WINDOW_AFTER_MS;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "Por confirmar";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "full", timeStyle: "short" });
}

function toPass(reg: RegRow, name: string): PassInfo {
  return {
    found: true,
    name,
    status: reg.status,
    checkedInAt: reg.checked_in_at,
    event: reg.event,
  };
}

const EMPTY: PassInfo = { found: false, name: "", status: null, checkedInAt: null, event: null };

/** Datos del pase para /pase/{token}: no marca nada, solo muestra. */
export const getEventPass = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(d))
  .handler(async ({ data }): Promise<PassInfo> => {
    const reg = await loadByToken(data.token);
    if (!reg) return EMPTY;
    const { name } = await identify(reg);
    return toPass(reg, name);
  });

/**
 * Núcleo del check-in, compartido por el enlace del asistente, el escáner del
 * personal y el respaldo por correo. Idempotente: el segundo paso informa la
 * hora de entrada en vez de duplicar.
 */
async function performCheckin(token: string, staffId: string | null): Promise<CheckinResult> {
    const reg = await loadByToken(token);
    if (!reg) return { ...EMPTY, reason: "not_found", emailSent: false, hasAccount: false };

    const { name, email } = await identify(reg);
    const pass = toPass(reg, name);
    const hasAccount = await hasAppAccount(email);

    if (reg.status === "Cancelled") return { ...pass, reason: "cancelled", emailSent: false, hasAccount };
    if (reg.status === "Pending") return { ...pass, reason: "pending", emailSent: false, hasAccount };
    if (reg.checked_in_at) return { ...pass, reason: "already", emailSent: false, hasAccount };
    if (!insideWindow(reg.event)) return { ...pass, reason: "outside_window", emailSent: false, hasAccount };

    const checkedInAt = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("event_registrations")
      .update({ status: "Attended", checked_in_at: checkedInAt, checked_in_by: staffId })
      .eq("id", reg.id);
    if (error) throw error;

    // El correo no debe bloquear la puerta: si falla, la entrada ya quedó marcada.
    let emailSent = false;
    if (email) {
      const invite = hasAccount
        ? ""
        : `<div style="margin-top:20px;padding:16px;background:#f6f7f6;border-radius:12px">
             <div style="font-size:14px;color:#0f172a;font-weight:600;margin-bottom:6px">¿Aún no tienes cuenta en Salgon?</div>
             <div style="font-size:13px;color:#475569;line-height:1.5;margin-bottom:12px">
               Es buen momento para crearla: podrás ver el inventario, los próximos eventos y tus citas
               desde tu teléfono. Un administrador revisa y activa tu cuenta antes de que puedas entrar.
             </div>
             ${emailButton(`${SITE_URL}/auth`, "Crear mi cuenta")}
           </div>`;

      const result = await sendEmail(
        email,
        `¡Bienvenido a ${reg.event?.title ?? "nuestro evento"}, ${name}!`,
        emailLayout({
          title: `¡Bienvenido, ${name}!`,
          body: `<p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.6">
                   Registramos tu entrada a <strong>${reg.event?.title ?? "el evento"}</strong>. Gracias por acompañarnos.
                 </p>
                 <p style="margin:0;font-size:13px;color:#64748b">${fmtDate(reg.event?.starts_at ?? null)}${
                   reg.event?.location ? ` · ${reg.event.location}` : ""
                 }</p>
                 ${invite}`,
        }),
      );
      emailSent = result.sent;
    }

    return { ...pass, status: "Attended", checkedInAt, reason: "ok", emailSent, hasAccount };
}

const TokenInput = (d: unknown) => z.object({ token: z.string().min(10).max(200) }).parse(d);

/** Lo que abre el asistente al escanear su propio QR o tocar "Ya llegué". */
export const checkInWithToken = createServerFn({ method: "POST" })
  .inputValidator(TokenInput)
  .handler(async ({ data }): Promise<CheckinResult> => performCheckin(data.token, null));

/** Escáner del personal: igual, pero registra quién marcó la entrada. */
export const checkInAsStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(TokenInput)
  .handler(async ({ data, context }): Promise<CheckinResult> =>
    performCheckin(data.token, context.userId),
  );

/**
 * Respaldo del QR impreso del evento: quien llegue sin su pase escribe su
 * correo y entra igual. No revela la lista de inscritos — solo confirma o no
 * la inscripción del correo que se teclea.
 */
export const checkInByEmail = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ event_id: z.string().uuid(), email: z.string().trim().email().max(255) }).parse(d),
  )
  .handler(async ({ data }): Promise<CheckinResult> => {
    const email = data.email.toLowerCase();

    const { data: byGuest } = await supabaseAdmin
      .from("event_registrations")
      .select("checkin_token")
      .eq("event_id", data.event_id)
      .ilike("guest_email", email)
      .maybeSingle();

    let token = byGuest?.checkin_token ?? null;

    // También puede ser un usuario de la app inscrito con su cuenta.
    if (!token) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (profile) {
        const { data: byUser } = await supabaseAdmin
          .from("event_registrations")
          .select("checkin_token")
          .eq("event_id", data.event_id)
          .eq("user_id", profile.id)
          .maybeSingle();
        token = byUser?.checkin_token ?? null;
      }
    }

    if (!token) return { ...EMPTY, reason: "not_found", emailSent: false, hasAccount: false };
    return performCheckin(token, null);
  });

export interface CheckinStats {
  eventTitle: string;
  approved: number;
  attended: number;
}

/** Contadores en vivo para la pantalla del escáner. */
export const eventCheckinStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<CheckinStats> => {
    const [{ data: ev }, { data: regs }] = await Promise.all([
      supabaseAdmin.from("events").select("title").eq("id", data.event_id).maybeSingle(),
      supabaseAdmin.from("event_registrations").select("status").eq("event_id", data.event_id),
    ]);
    const rows = regs ?? [];
    return {
      eventTitle: ev?.title ?? "Evento",
      // "Aprobados" incluye a los que ya entraron: son el total esperado en la puerta.
      approved: rows.filter((r) => r.status === "Confirmed" || r.status === "Attended").length,
      attended: rows.filter((r) => r.status === "Attended").length,
    };
  });

/**
 * Admin: aprueba o rechaza una inscripción. Al aprobar envía el correo con el
 * enlace al pase, que es la única vía por la que el asistente recibe su QR.
 */
export const decideRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["Confirmed", "Cancelled"]) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; emailSent: boolean; error?: string }> => {
    const { data: isAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!isAdmin) throw new Response("Forbidden: admin role required", { status: 403 });

    const { data: reg, error: regErr } = await supabaseAdmin
      .from("event_registrations")
      .select(`${SELECT}, checkin_token`)
      .eq("id", data.id)
      .maybeSingle();
    if (regErr) return { ok: false, emailSent: false, error: regErr.message };
    if (!reg) return { ok: false, emailSent: false, error: "La inscripción ya no existe" };

    const { error } = await supabaseAdmin
      .from("event_registrations")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) return { ok: false, emailSent: false, error: error.message };

    if (data.status !== "Confirmed") return { ok: true, emailSent: false };

    const row = reg as unknown as RegRow & { checkin_token: string };
    const { name, email } = await identify(row);
    if (!email) return { ok: true, emailSent: false };

    const passUrl = `${SITE_URL}/pase/${row.checkin_token}`;
    const result = await sendEmail(
      email,
      `Tu lugar está confirmado: ${row.event?.title ?? "evento Salgon"}`,
      emailLayout({
        title: "¡Tu lugar está confirmado!",
        body: `<p style="margin:0 0 10px;font-size:14px;color:#334155;line-height:1.6">
                 Hola ${name}, Inmobiliaria Salgon aprobó tu solicitud para
                 <strong>${row.event?.title ?? "el evento"}</strong>.
               </p>
               <p style="margin:0 0 16px;font-size:13px;color:#64748b">
                 ${fmtDate(row.event?.starts_at ?? null)}${row.event?.location ? ` · ${row.event.location}` : ""}
               </p>
               <p style="margin:0 0 16px;font-size:14px;color:#334155;line-height:1.6">
                 Muestra este pase en la entrada. Trae el código a la mano en tu teléfono:
               </p>
               ${emailButton(passUrl, "Ver mi pase")}
               <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">
                 Si el botón no funciona, abre este enlace: ${passUrl}
               </p>`,
      }),
    );

    return { ok: true, emailSent: result.sent };
  });
