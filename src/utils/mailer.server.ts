/**
 * Envío de correo por Resend, compartido por todas las server functions.
 *
 * Nunca lanza: un correo que no sale no debe tumbar la operación que lo
 * disparó (aprobar una inscripción, registrar una entrada en la puerta).
 * Devuelve el resultado para que quien llama pueda avisarlo si le sirve.
 *
 * El remitente sale de MAIL_FROM. Mientras el dominio salgon.com no esté
 * verificado en Resend, el valor por defecto es la dirección compartida de
 * pruebas, que SOLO entrega al correo dueño de la cuenta de Resend.
 */
const RESEND_URL = "https://api.resend.com/emails";
const DEFAULT_FROM = "Salgon CRM <onboarding@resend.dev>";

export interface MailResult {
  sent: boolean;
  reason?: string;
}

export function mailFrom(): string {
  return process.env.MAIL_FROM || DEFAULT_FROM;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "missing_api_key" };
  if (!to) return { sent: false, reason: "missing_recipient" };

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: mailFrom(), to: [to], subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[mailer] Resend ${res.status}: ${body}`);
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[mailer] fetch failed:", err);
    return { sent: false, reason: "network" };
  }
}

/** Envoltura común de las plantillas, para que todos los correos se vean igual. */
export function emailLayout(opts: { title: string; body: string; footer?: string }): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f7f6;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6e8e6">
    <div style="background:#1a5c38;padding:18px 24px;color:#fff">
      <div style="font-size:16px;font-weight:600">Inmobiliaria Salgon</div>
      <div style="font-size:12px;opacity:.85">Bienes Raíces</div>
    </div>
    <div style="padding:24px">
      <h1 style="margin:0 0 12px;font-size:19px;color:#0f172a">${opts.title}</h1>
      ${opts.body}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #eef0ee;color:#64748b;font-size:11px">
      ${opts.footer ?? "Este mensaje se envió porque te inscribiste a un evento de Inmobiliaria Salgon."}
    </div>
  </div>
</div>`;
}

/** Botón de acción reutilizable, con estilos en línea para los clientes de correo. */
export function emailButton(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1a5c38;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px">${label}</a>`;
}
