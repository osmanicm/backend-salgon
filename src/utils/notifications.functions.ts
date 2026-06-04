import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RESEND_URL = "https://api.resend.com/emails";
const FROM = "Salgon CRM <onboarding@resend.dev>";

async function sendEmail(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { skipped: true };
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend ${res.status}: ${body}`);
  }
  return res.json();
}

function adminEmail() {
  return process.env.ADMIN_EMAIL ?? "osmanicm@gmail.com";
}

const LeadSchema = z.object({
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  interest: z.string(),
  budget: z.number(),
  source: z.string(),
});

export const notifyNewLead = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LeadSchema.parse(d))
  .handler(async ({ data }) => {
    await sendEmail(
      adminEmail(),
      `Nuevo prospecto: ${data.name}`,
      `<h2 style="color:#1a5c38;font-family:sans-serif">Nuevo prospecto en Salgon CRM</h2>
       <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;margin-top:8px">
         <tr><td style="padding:4px 16px 4px 0;color:#666">Nombre</td><td><strong>${data.name}</strong></td></tr>
         <tr><td style="padding:4px 16px 4px 0;color:#666">Teléfono</td><td>${data.phone}</td></tr>
         <tr><td style="padding:4px 16px 4px 0;color:#666">Correo</td><td>${data.email}</td></tr>
         <tr><td style="padding:4px 16px 4px 0;color:#666">Interés</td><td>${data.interest}</td></tr>
         <tr><td style="padding:4px 16px 4px 0;color:#666">Presupuesto</td><td>$${data.budget.toLocaleString("es-MX")} MXN</td></tr>
         <tr><td style="padding:4px 16px 4px 0;color:#666">Origen</td><td>${data.source}</td></tr>
       </table>`
    );
    return { ok: true };
  });

const AppointmentSchema = z.object({
  clientName: z.string(),
  clientPhone: z.string(),
  scheduledAt: z.string(),
  propertyTitle: z.string().optional(),
  notes: z.string().optional(),
});

export const notifyNewAppointment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => AppointmentSchema.parse(d))
  .handler(async ({ data }) => {
    const fecha = new Date(data.scheduledAt).toLocaleString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Mexico_City",
    });
    await sendEmail(
      adminEmail(),
      `Nueva cita: ${data.clientName}`,
      `<h2 style="color:#1a5c38;font-family:sans-serif">Nueva cita en Salgon CRM</h2>
       <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;margin-top:8px">
         <tr><td style="padding:4px 16px 4px 0;color:#666">Cliente</td><td><strong>${data.clientName}</strong></td></tr>
         <tr><td style="padding:4px 16px 4px 0;color:#666">Teléfono</td><td>${data.clientPhone}</td></tr>
         <tr><td style="padding:4px 16px 4px 0;color:#666">Fecha y hora</td><td>${fecha}</td></tr>
         ${data.propertyTitle ? `<tr><td style="padding:4px 16px 4px 0;color:#666">Propiedad</td><td>${data.propertyTitle}</td></tr>` : ""}
         ${data.notes ? `<tr><td style="padding:4px 16px 4px 0;color:#666">Notas</td><td>${data.notes}</td></tr>` : ""}
       </table>`
    );
    return { ok: true };
  });
