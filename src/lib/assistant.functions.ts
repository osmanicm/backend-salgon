import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(30),
  context: z.string().max(60).optional(),
});

const SYSTEM_PROMPT = `Eres "Salgon Assistant", un asistente comercial inmobiliario para la app Salgon.
Respondes en español, de forma concisa, clara y profesional.

REGLAS ESTRICTAS:
- SOLO usas datos reales obtenidos a través de las herramientas (tools) disponibles.
- NUNCA inventas precios, lotes, modelos o disponibilidad.
- NUNCA expones JSON ni IDs internos. Formatea siempre los precios como MXN con separadores (ej. $2,980,000 MXN).
- Si la pregunta requiere datos, llama primero a la herramienta correspondiente.
- Si no hay resultados, dilo claramente y sugiere alternativas.
- Solo lectura: jamás propones modificar la base de datos.
- Si el usuario pregunta algo fuera de propiedades/disponibilidad, responde brevemente y reorienta.

Estados posibles: Available (Disponible), Reserved (Reservado), Sold (Vendido).

AGENDAR CITAS (muy importante):
- Si el usuario quiere agendar una cita / visita / recorrido, recolecta estos datos: modelo, lote, fecha, hora y nombre del cliente.
- Si falta algún dato, pregúntalo de forma natural y breve, UNO o DOS a la vez. NO inventes datos. NO reinicies el contexto: mantén lo ya proporcionado entre mensajes.
- Antes de crear la cita, RESUELVE la propiedad llamando a "resolve_property" con modelo y lote. Si no existe, infórmalo y sugiere alternativas (puedes consultar search_availability/search_properties).
- Una vez tengas TODOS los datos y la propiedad resuelta, confirma con el usuario en un solo mensaje: "¿Confirmas agendar la cita para <Modelo> lote <Lote> el <fecha legible> a las <hora> a nombre de <cliente>?".
- SOLO si el usuario confirma (sí, confirmo, dale, ok, adelante, etc.), llama a "create_appointment" con property_id, client_name, scheduled_at (ISO 8601 en zona America/Mexico_City) y opcionalmente client_phone/notes.
- Si el usuario cancela, descarta la operación y ofrece ayuda adicional.
- Sugiere horarios comunes (10:00, 12:00, 16:00) cuando preguntes la hora.
- Interpreta fechas relativas en español (hoy, mañana, "el próximo viernes", "11 de mayo") asumiendo el año actual o el siguiente si la fecha ya pasó. Hora por defecto AM si es ambiguo y razonable.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "search_availability",
      description:
        "Busca lotes en el inventario de disponibilidad. Filtra por modelo, lote, estatus, desarrollo o rango de precio. Devuelve hasta 25 resultados.",
      parameters: {
        type: "object",
        properties: {
          model: { type: "string", description: "Nombre del modelo, ej. Jazmín, Tulipán" },
          lot: { type: "string", description: "Número o identificador del lote" },
          status: { type: "string", enum: ["Available", "Reserved", "Sold"] },
          desarrollo: { type: "string", description: "Nombre del desarrollo / cluster" },
          min_price: { type: "number" },
          max_price: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_properties",
      description: "Busca propiedades publicadas (no eliminadas). Filtra por modelo, lote, ubicación, estatus.",
      parameters: {
        type: "object",
        properties: {
          model: { type: "string" },
          lot: { type: "string" },
          location: { type: "string" },
          status: { type: "string", enum: ["Available", "Reserved", "Sold"] },
          min_price: { type: "number" },
          max_price: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "inventory_summary",
      description: "Resumen agregado del inventario: cuenta por estatus y por modelo.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

async function runTool(name: string, args: any, supabase: any) {
  if (name === "search_availability") {
    let q = supabase
      .from("availability_units")
      .select("model, lot, desarrollo, price, status, delivery, notes")
      .limit(25);
    if (args.model) q = q.ilike("model", `%${args.model}%`);
    if (args.lot) q = q.ilike("lot", `%${args.lot}%`);
    if (args.status) q = q.eq("status", args.status);
    if (args.desarrollo) q = q.ilike("desarrollo", `%${args.desarrollo}%`);
    if (typeof args.min_price === "number") q = q.gte("price", args.min_price);
    if (typeof args.max_price === "number") q = q.lte("price", args.max_price);
    const { data, error } = await q;
    if (error) return { error: error.message };
    return { count: data?.length ?? 0, results: data ?? [] };
  }
  if (name === "search_properties") {
    let q = supabase
      .from("properties")
      .select("code, title, model, lot, location, price, status, bedrooms, bathrooms, area")
      .is("deleted_at", null)
      .limit(25);
    if (args.model) q = q.ilike("model", `%${args.model}%`);
    if (args.lot) q = q.ilike("lot", `%${args.lot}%`);
    if (args.location) q = q.ilike("location", `%${args.location}%`);
    if (args.status) q = q.eq("status", args.status);
    if (typeof args.min_price === "number") q = q.gte("price", args.min_price);
    if (typeof args.max_price === "number") q = q.lte("price", args.max_price);
    const { data, error } = await q;
    if (error) return { error: error.message };
    return { count: data?.length ?? 0, results: data ?? [] };
  }
  if (name === "inventory_summary") {
    const { data, error } = await supabase
      .from("availability_units")
      .select("model, status, price");
    if (error) return { error: error.message };
    const byStatus: Record<string, number> = {};
    const byModel: Record<string, { total: number; available: number }> = {};
    for (const r of data ?? []) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      const m = byModel[r.model] ?? { total: 0, available: 0 };
      m.total += 1;
      if (r.status === "Available") m.available += 1;
      byModel[r.model] = m;
    }
    return { total: data?.length ?? 0, by_status: byStatus, by_model: byModel };
  }
  return { error: `Tool desconocida: ${name}` };
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { reply: "El asistente no está configurado (falta LOVABLE_API_KEY)." };
    }
    const { supabase } = context as { supabase: any };

    const sys = data.context
      ? `${SYSTEM_PROMPT}\n\nContexto actual del usuario: módulo "${data.context}". Prioriza ese tipo de información.`
      : SYSTEM_PROMPT;

    const convo: any[] = [
      { role: "system", content: sys },
      ...data.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    for (let step = 0; step < 4; step++) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: convo,
          tools: TOOLS,
        }),
      });
      if (resp.status === 429) return { reply: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." };
      if (resp.status === 402) return { reply: "Se agotaron los créditos del asistente. Contacta al administrador." };
      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI gateway error", resp.status, t);
        return { reply: "Ocurrió un error al consultar el asistente." };
      }
      const json = await resp.json();
      const msg = json.choices?.[0]?.message;
      if (!msg) return { reply: "No recibí respuesta del asistente." };

      const toolCalls = msg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        return { reply: (msg.content ?? "").toString() || "Sin respuesta." };
      }

      convo.push({
        role: "assistant",
        content: msg.content ?? "",
        tool_calls: toolCalls,
      });
      for (const tc of toolCalls) {
        let args: any = {};
        try {
          args = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch {
          args = {};
        }
        const result = await runTool(tc.function?.name, args, supabase);
        convo.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result).slice(0, 8000),
        });
      }
    }
    return { reply: "No pude completar la consulta tras varios intentos. Intenta reformular." };
  });
