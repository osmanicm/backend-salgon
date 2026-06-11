# Conectar el Asistente IA a Gemini (API directa) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que el asistente IA (`AssistantWidget` + `askAssistant`) funcione llamando directamente a la API de Gemini con la API key del usuario, en vez del gateway de Lovable.

**Architecture:** Cambio mínimo, concentrado en `src/lib/assistant.functions.ts`. Se reapunta el `fetch` al endpoint OpenAI-compatible de Gemini (`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`), se cambia la variable de entorno (`LOVABLE_API_KEY` → `GEMINI_API_KEY`), el nombre del modelo (`google/gemini-2.5-flash` → `gemini-2.5-flash`) y el mapeo de errores. El loop de tool-calling estilo OpenAI y las 5 herramientas (`runTool`) se **reutilizan sin cambios** porque Gemini soporta function-calling en formato OpenAI.

**Tech Stack:** TanStack React Start server functions, Gemini API (endpoint OpenAI-compat), Supabase (RLS por usuario), Cloudflare Workers (secrets vía wrangler).

**Nota sobre testing:** Este proyecto NO tiene runner de unit tests (solo Playwright E2E + verificación manual, según `CLAUDE.md`). La verificación de cada cambio se hace con `tsc`, `eslint` sobre el archivo y un **smoke test manual** documentado en la Task 4. No se introduce un framework de unit tests nuevo (YAGNI).

**Spec de referencia:** `docs/superpowers/specs/2026-06-11-asistente-gemini-design.md`

---

## File Structure

- **Modify:** `src/lib/assistant.functions.ts` — único archivo de lógica que cambia (constantes de endpoint/modelo, env var, fetch, manejo de errores). El loop y `runTool` no cambian.
- **Modify:** `.env` — agregar `GEMINI_API_KEY` (git-ignored, valor real lo pega el usuario).
- **Modify:** `.env.example` — documentar `GEMINI_API_KEY=`.
- **Sin cambios:** `src/components/assistant/AssistantWidget.tsx` (ya consume `askAssistant` correctamente).

---

### Task 1: Configurar la variable de entorno en dev

**Files:**
- Modify: `.env` (git-ignored)
- Modify: `.env.example`

- [ ] **Step 1: Agregar la key real a `.env`**

Agregar al final de `.env` (el usuario pega su API key de Gemini de Google AI Studio):

```
# Asistente IA — Gemini API key (Google AI Studio)
GEMINI_API_KEY=AIza...la_key_real_del_usuario
```

⚠️ `.env` está en `.gitignore` — el valor real NUNCA se commitea.

- [ ] **Step 2: Documentar la variable en `.env.example`**

Agregar al final de `.env.example`:

```
# Asistente IA — Gemini API key (https://aistudio.google.com/apikey)
GEMINI_API_KEY=
```

- [ ] **Step 3: Commit (solo el example, NO el .env)**

```bash
git add .env.example
git commit -m "chore: documentar GEMINI_API_KEY en .env.example"
```

---

### Task 2: Reapuntar `askAssistant` a la API de Gemini

**Files:**
- Modify: `src/lib/assistant.functions.ts`

- [ ] **Step 1: Agregar constantes de endpoint y modelo**

Justo después de la línea `import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";` (línea 3), agregar:

```ts
// Endpoint OpenAI-compatible de Gemini. Soporta tool-calling en formato OpenAI
// (tools / tool_calls / role:"tool" / tool_call_id), por lo que el loop de abajo
// se reutiliza sin cambios. Doc: https://ai.google.dev/gemini-api/docs/openai
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODEL = "gemini-2.5-flash";
```

- [ ] **Step 2: Cambiar la lectura de la API key**

Reemplazar el bloque actual (líneas ~258-261):

```ts
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { reply: "El asistente no está configurado (falta LOVABLE_API_KEY)." };
    }
```

por:

```ts
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { reply: "El asistente no está configurado (falta GEMINI_API_KEY)." };
    }
```

- [ ] **Step 3: Reapuntar el `fetch` al endpoint de Gemini**

Reemplazar la llamada `fetch` dentro del loop (líneas ~276-287):

```ts
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
```

por:

```ts
      const resp = await fetch(GEMINI_BASE_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GEMINI_MODEL,
          messages: convo,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });
```

- [ ] **Step 4: Adaptar el manejo de errores a Gemini**

Reemplazar el bloque de manejo de status (líneas ~288-294):

```ts
      if (resp.status === 429) return { reply: "Demasiadas solicitudes. Intenta de nuevo en unos segundos." };
      if (resp.status === 402) return { reply: "Se agotaron los créditos del asistente. Contacta al administrador." };
      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI gateway error", resp.status, t);
        return { reply: "Ocurrió un error al consultar el asistente." };
      }
```

por:

```ts
      if (resp.status === 429) {
        return { reply: "Demasiadas solicitudes a la IA. Intenta de nuevo en unos segundos." };
      }
      if (resp.status === 401 || resp.status === 403) {
        const t = await resp.text();
        console.error("Gemini auth error", resp.status, t);
        return { reply: "El asistente no está autorizado. Verifica la GEMINI_API_KEY." };
      }
      if (!resp.ok) {
        const t = await resp.text();
        console.error("Gemini API error", resp.status, t);
        return { reply: "Ocurrió un error al consultar el asistente." };
      }
```

- [ ] **Step 5: Verificar que no quedaron referencias a Lovable**

Run: `grep -ni "lovable" src/lib/assistant.functions.ts`
Expected: sin resultados (exit 1 / vacío).

---

### Task 3: Verificación estática (tipos + lint)

**Files:**
- (verificación, no cambios)

- [ ] **Step 1: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: sin errores (salida vacía).

- [ ] **Step 2: Lint solo del archivo modificado**

Run: `node_modules/.bin/eslint src/lib/assistant.functions.ts`
Expected: sin errores nuevos. (Nota: pueden aparecer warnings preexistentes de CRLF `␍`; no reformatear el archivo entero por eso — ver memoria del proyecto.)

---

### Task 4: Smoke test manual en dev (verificación funcional principal)

**Files:**
- (verificación manual)

Este es el paso que confirma que el function-calling de Gemini-compat (en beta) funciona de verdad.

- [ ] **Step 1: Arrancar el dev server con la env cargada**

Run: `bun run dev`
Expected: servidor en `http://localhost:8080`. Iniciar sesión (admin: `inmobiliariasalgon@gmail.com`).

- [ ] **Step 2: Probar herramienta de lectura simple**

Abrir el widget (botón flotante con ✨ "IA", abajo-izquierda). Enviar: **"Resumen del inventario"**.
Expected: respuesta en español con conteos reales por estatus/modelo (ejercita `inventory_summary`). No debe responder "no está configurado" ni "error".

- [ ] **Step 3: Probar búsqueda con filtro**

Enviar: **"Muéstrame propiedades disponibles"**.
Expected: lista de propiedades reales con precios formateados como MXN (ejercita `search_properties`/`search_availability`).

- [ ] **Step 4: Probar el flujo completo de agendar cita**

Enviar: **"Agéndame una cita para visitar el modelo &lt;X&gt; lote &lt;Y&gt; mañana a las 10am a nombre de Juan Pérez"** (usar un modelo/lote que exista según el Step 3).
Expected: el asistente resuelve la propiedad (`resolve_property`), pide confirmación en un solo mensaje, y al confirmar ("sí, confirmo") responde con éxito (ejercita `create_appointment`).

- [ ] **Step 5: Verificar que la cita se creó en Supabase**

Verificar en la vista `/appointments` (o `/agent`) que la cita aparece con el cliente y horario correctos.
Expected: cita visible, asignada al usuario actual.

- [ ] **Step 6 (contingencia): si algún paso devuelve un error 400 de esquema**

Si el server log muestra un error 400 de Gemini quejándose de `additionalProperties` u otro campo de JSON schema, editar `src/lib/assistant.functions.ts` y quitar las líneas `additionalProperties: false,` de cada objeto `parameters` dentro de `TOOLS` (líneas ~56, 76, 84, 100, 124). Repetir Step 2-5. (Solo aplicar si falla; no quitar preventivamente.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/assistant.functions.ts
git commit -m "feat: conectar el asistente IA a la API de Gemini (gemini-2.5-flash)"
```

---

### Task 5: Configurar el secret en producción y desplegar

**Files:**
- (configuración de Cloudflare Workers)

Ejecutar solo cuando el smoke test en dev haya pasado y se quiera publicar.

- [ ] **Step 1: Subir el secret a Workers**

El usuario ejecuta (interactivo — pega la key cuando la pida):

```
wrangler secret put GEMINI_API_KEY
```

Expected: "Success! Uploaded secret GEMINI_API_KEY".

- [ ] **Step 2: Build + patch + deploy**

Según las notas de deploy del proyecto:

```bash
bun run build
```
```powershell
(Get-Content dist/server/wrangler.json) -replace '"workers_dev":false', '"workers_dev":true' | Set-Content dist/server/wrangler.json
```
```bash
npx wrangler deploy
```
Expected: deploy exitoso a `app.salgon.com` / `app-salgon.inmobiliariasalgon.workers.dev`.

- [ ] **Step 3: Verificar en producción**

Abrir la app en producción, iniciar sesión y repetir Step 2 de la Task 4 ("Resumen del inventario").
Expected: respuesta real del asistente.

---

## Self-Review

**Spec coverage:**
- Cambio de env var `LOVABLE_API_KEY`→`GEMINI_API_KEY` → Task 2 Step 2, Task 1.
- Endpoint OpenAI-compat + modelo `gemini-2.5-flash` → Task 2 Steps 1, 3.
- Reutilizar loop + `runTool` sin cambios → confirmado (no hay task que los toque).
- Manejo de errores Gemini (400/401/403/429) → Task 2 Step 4.
- Contingencia `additionalProperties` → Task 4 Step 6.
- `.env` dev + `.env.example` + wrangler secret prod → Task 1, Task 5.
- Smoke test ejercitando cada herramienta + flujo de cita → Task 4.
- Frontend sin cambios → reflejado en File Structure.
- Verificar rate limits (429 amable) → Task 2 Step 4 (mensaje 429).

**Placeholder scan:** Sin TBD/TODO; cada step tiene código o comando concreto. ✅

**Type consistency:** `GEMINI_BASE_URL`, `GEMINI_MODEL`, `GEMINI_API_KEY` usados consistentemente entre steps. ✅

Sin huecos detectados.
