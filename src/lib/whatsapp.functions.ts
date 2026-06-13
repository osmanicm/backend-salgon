import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GRAPH_VERSION = process.env.WHATSAPP_API_VERSION || "v22.0";

const InputSchema = z.object({
  templateId: z.string().uuid(),
  toPhone: z.string().min(8).max(20),
  variables: z.array(z.string()).max(10).default([]),
  media: z
    .object({
      kind: z.enum(["image", "document"]),
      dataUrl: z.string(),
      filename: z.string().max(200),
      mimeType: z.string().max(100),
    })
    .nullable()
    .optional(),
  leadId: z.string().uuid().nullable().optional(),
});

/** Normaliza a dígitos con código de país (MX por defecto). Cloud API espera dígitos sin '+'. */
function normalizeMxPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 10) return "52" + digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

function friendlyMetaError(status: number, code: number | undefined, message: string): string {
  if (code === 132001 || /template/i.test(message))
    return "La plantilla no existe o no está aprobada en Meta. Revisa el nombre y el idioma.";
  if (code === 131030 || /allowed list/i.test(message))
    return "El número no está en la lista permitida de Meta (modo pruebas). Agrégalo o pasa la app a producción.";
  if (code === 131026 || /undeliverable/i.test(message))
    return "El mensaje no se pudo entregar a ese número (¿tiene WhatsApp?).";
  if (code === 100 || status === 400)
    return "Parámetros inválidos en el envío. Revisa las variables de la plantilla.";
  if (status === 401 || status === 403) return "Token de WhatsApp inválido o sin permisos.";
  if (status === 429) return "Límite de envíos alcanzado. Intenta más tarde.";
  return "No se pudo enviar el mensaje por WhatsApp.";
}

async function uploadMedia(
  token: string,
  phoneId: string,
  media: { dataUrl: string; filename: string; mimeType: string },
): Promise<{ id?: string; error?: string }> {
  const base64 = media.dataUrl.includes(",") ? media.dataUrl.split(",")[1] : media.dataUrl;
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("file", new Blob([bytes], { type: media.mimeType }), media.filename);
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok) return { error: json?.error?.message || "upload failed" };
  return { id: json.id };
}

export const sendWhatsappTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
      return { ok: false as const, error: "WhatsApp no está configurado (faltan secrets)." };
    }
    const { supabase, userId } = context as {
      supabase: { from: (t: string) => any };
      userId: string;
    };

    const { data: tpl, error: tplErr } = await supabase
      .from("whatsapp_templates")
      .select("id, name, meta_template_name, meta_language, header_format")
      .eq("id", data.templateId)
      .is("deleted_at", null)
      .maybeSingle();
    if (tplErr) return { ok: false as const, error: tplErr.message };
    if (!tpl) return { ok: false as const, error: "Plantilla no encontrada." };
    if (!tpl.meta_template_name)
      return { ok: false as const, error: "La plantilla no está vinculada a Meta (falta el nombre de plantilla aprobada)." };

    const to = normalizeMxPhone(data.toPhone);
    if (!to) return { ok: false as const, error: "Teléfono inválido." };

    const components: unknown[] = [];

    if (tpl.header_format === "IMAGE" || tpl.header_format === "DOCUMENT") {
      if (!data.media)
        return { ok: false as const, error: "Esta plantilla requiere un archivo en el encabezado." };
      const up = await uploadMedia(token, phoneId, data.media);
      if (up.error || !up.id)
        return { ok: false as const, error: "No se pudo subir el archivo a WhatsApp: " + (up.error ?? "") };
      const kind = tpl.header_format === "IMAGE" ? "image" : "document";
      const mediaParam =
        kind === "document"
          ? { type: "document", document: { id: up.id, filename: data.media.filename } }
          : { type: "image", image: { id: up.id } };
      components.push({ type: "header", parameters: [mediaParam] });
    }

    if (data.variables.length > 0) {
      components.push({
        type: "body",
        parameters: data.variables.map((v) => ({ type: "text", text: v })),
      });
    }

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: tpl.meta_template_name,
        language: { code: tpl.meta_language || "es_MX" },
        ...(components.length ? { components } : {}),
      },
    };

    let metaMessageId: string | null = null;
    let sendError: string | null = null;
    try {
      const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        messages?: { id?: string }[];
        error?: { code?: number; message?: string };
      };
      if (!res.ok) {
        console.error("WhatsApp send error", res.status, JSON.stringify(json));
        sendError = friendlyMetaError(res.status, json?.error?.code, json?.error?.message ?? "");
      } else {
        metaMessageId = json?.messages?.[0]?.id ?? null;
      }
    } catch (e) {
      console.error("WhatsApp fetch failed", e);
      sendError = "No se pudo contactar a WhatsApp.";
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("whatsapp_messages").insert({
        lead_id: data.leadId ?? null,
        template_id: tpl.id,
        to_phone: to,
        meta_message_id: metaMessageId,
        status: sendError ? "error" : "sent",
        error: sendError,
        sent_by: userId,
      });
    } catch (e) {
      console.error("WhatsApp log failed", e);
    }

    if (sendError) return { ok: false as const, error: sendError };
    return { ok: true as const, messageId: metaMessageId };
  });
