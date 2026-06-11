# Diseño — Conectar el Asistente IA a Gemini (API directa)

**Fecha:** 2026-06-11
**Estado:** Diseño aprobado → pasar a plan de implementación.
**Gap que cierra:** El asistente (`AssistantWidget` + `askAssistant`) no funciona porque apunta al **gateway de Lovable** (`https://ai.gateway.lovable.dev`) con `LOVABLE_API_KEY`, que no está configurada y crea dependencia de Lovable. El usuario tiene su propia API key de Gemini (cuenta Google AI Pro) y quiere usar el modelo `gemini-2.5-flash`.

## Decisiones (brainstorming 2026-06-11)

| Decisión | Elección |
|----------|----------|
| Enfoque de integración | **Opción A — endpoint OpenAI-compatible de Gemini**. Reutiliza el loop de tool-calling actual; cambio mínimo. |
| Modelo | `gemini-2.5-flash` (constante configurable) |
| Proveedor | Gemini API directa de Google (no Lovable, no Vertex) |

## Hechos verificados

- Endpoint OpenAI-compat: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
- Auth: header `Authorization: Bearer <GEMINI_API_KEY>`
- Soporta function-calling en formato OpenAI (`tools`, `tool_calls`, `role: "tool"`, `tool_call_id`) — lo que el loop actual ya usa.
- ⚠️ El soporte de librerías OpenAI está **en beta**; requiere test de humo de tool-calling.
- Inyección de env en el proyecto: `process.env.*`; en dev vía `.env` (git-ignored), en Workers vía `wrangler secret put`. Hoy `.env` NO tiene `LOVABLE_API_KEY` (el asistente nunca corrió de verdad).

## Cambios de alcance

### 1. `src/lib/assistant.functions.ts` (núcleo)
- Leer `process.env.GEMINI_API_KEY` en vez de `LOVABLE_API_KEY`; mensaje de "no configurado" actualizado.
- Constantes nuevas: `GEMINI_BASE_URL` y `GEMINI_MODEL = "gemini-2.5-flash"`.
- `fetch` apunta al endpoint OpenAI-compat de Gemini; body con `model: GEMINI_MODEL` (sin el prefijo `google/`), `messages`, `tools`, y `tool_choice: "auto"`.
- Mantener el loop de 6 pasos y `runTool` **sin cambios** (las 5 herramientas y RLS por usuario siguen igual).
- Manejo de errores adaptado a Gemini: 400 (key/parámetros inválidos), 401/403 (key no autorizada), 429 (rate limit). Eliminar el caso 402 específico de Lovable o re-mapearlo. Loguear cuerpo de error en server.
- Posible ajuste de esquema de herramientas si Gemini rechaza `additionalProperties: false` (verificar en test de humo; quitar solo si falla).

### 2. Configuración de entorno
- `.env` (dev): agregar `GEMINI_API_KEY=...` (el usuario lo pega; no se commitea).
- `.env.example`: documentar `GEMINI_API_KEY=` con comentario.
- Prod: `wrangler secret put GEMINI_API_KEY`.

### 3. Frontend `AssistantWidget.tsx`
- Sin cambios funcionales (ya consume `askAssistant`). Revisión menor de copy si aplica.

## Pruebas

- **Test de humo manual** (dev): preguntas que ejerciten cada herramienta — "propiedades disponibles" (search), "resumen del inventario" (inventory_summary), y un flujo de agendar cita de punta a punta (resolve_property → confirmación → create_appointment) verificando que la cita aparezca en Supabase. Confirma que el function-calling de Gemini-compat funciona.
- **Unit** (si se extrae lógica pura): mapeo de errores HTTP→mensaje en español; construcción del body de request.
- **Verificar rate limits** de la key (cuenta AI Pro vs API con facturación): que 429 devuelva mensaje amable.
- E2E: opcional, mockear el límite de red; el modelo real no se E2E-ea.

## Fuera de alcance

- Streaming de respuestas.
- Persistir historial de conversaciones del asistente.
- Cambiar/expandir las herramientas o el prompt (es otra mejora).
- Migrar a API nativa de Gemini (Opción B) — solo si el compat beta diera problemas irresolubles.

## Riesgos

- Function-calling de Gemini-compat en beta → mitigado con test de humo temprano; fallback documentado a Opción B si falla.
- Cuota/limites de la key (Google AI Pro ≠ necesariamente cuota de API con facturación) → verificar 429 y comunicar.
