# Diseño: Embudo de Ventas para agentes + seguimiento en tarjeta

**Fecha:** 2026-07-31
**Estado:** Aprobado
**Rama:** `feat/pipeline-agent-access`

## Objetivo

Que un **agente** acceda a **Embudo de Ventas** (`/pipeline`), vea **sus propios prospectos**
organizados por etapa, y pueda: (a) arrastrarlos entre etapas (cambia `lead.status`), y (b) dar
seguimiento desde la tarjeta fijando un **"próximo contacto" (fecha)** y editando la **nota**. Tanto
agente como admin actualizan el embudo. Continúa el patrón de [[leads-agent-access]].

## Contexto / estado actual

- `/pipeline` (`src/routes/pipeline.tsx`) es un tablero Kanban con `@dnd-kit` sobre los **mismos
  datos de leads**: columnas = `lead.status` (`New → Contacted → Visit → Negotiation → Closed`);
  arrastrar una tarjeta hace `useUpdateLead({ id, patch: { status } })`.
- Usa `useLeads()` + `useUpdateLead()` (`src/data/leadsApi.ts`), ya acotados por RLS
  (`agent_id = auth.uid() OR admin`). El `agent_id` no cambia al arrastrar → la actualización pasa
  RLS. **"Ambos actualizan" ya funciona.**
- **Bloqueo actual**: `/pipeline` está en `ADMIN_ONLY_PATHS` (`src/components/layout/AppShell.tsx`)
  → 403 para agentes. La navegación de agente no muestra "Embudo de Ventas".
- Primitivas UI disponibles: `popover`, `calendar`, `dialog`, `textarea`, `input`, `button`,
  `badge` en `src/components/ui/`.
- La tabla `leads` NO tiene columna de próximo contacto (`next_contact_at` ausente en `types.ts`).

## Decisiones de producto (aprobadas)

- Seguimiento en la tarjeta = **próximo contacto (fecha)** + **reusar el campo `notes` existente**
  (al editar desde el embudo se sobrescribe la misma nota que se ve en Prospectos).
- Resaltado **"vencido"** cuando `next_contact_at < hoy` **y** el lead **no** está `Closed`.
- En móvil, el embudo se alcanza sólo vía "Más" (la barra inferior no cambia).

## Cambios

### 1. Acceso (patrón de Prospectos) — CERO cambios de RLS

- `AppShell.tsx`: remover `"/pipeline"` de `ADMIN_ONLY_PATHS`.
- `Sidebar.tsx` (`agentNav`): agregar `{ to: "/pipeline", label: "Embudo de Ventas", icon:
  KanbanSquare }` después de "Citas" (`KanbanSquare` ya está importado; usarlo).
- `more.tsx`: quitar `adminOnly: true` del ítem `"/pipeline"` (sección Operaciones).
- `BottomNav.tsx`: sin cambios.

### 2. Migración: columna de próximo contacto

- Nueva migración `supabase/migrations/<ts>_leads_next_contact.sql`:
  `alter table public.leads add column next_contact_at date;` (nullable, sin default).
- **Sin cambios de políticas RLS**: las políticas por fila de `leads` cubren todas las columnas.
- Regenerar `src/integrations/supabase/types.ts` (incluye `next_contact_at: string | null`).

### 3. Seguimiento en la tarjeta (`src/routes/pipeline.tsx`)

- La `LeadCard` del embudo muestra, bajo el teléfono:
  - Si `next_contact_at` está fijado: badge "Próx: DD MMM". Si `next_contact_at < hoy` y
    `status !== "Closed"` → variante roja (vencido).
  - Si es `null`: affordance sutil "+ seguimiento".
- Botón/ícono de seguimiento (p. ej. `CalendarClock`) abre un **Popover** con:
  - **Calendar** (react-day-picker vía `ui/calendar`) para fijar el próximo contacto + acción
    "Limpiar" (set a `null`).
  - **Textarea** para la nota (valor inicial `lead.notes`).
  - Botón "Guardar" → `useUpdateLead({ id, patch: { next_contact_at, notes } })` con toast de
    éxito/error. El popover se cierra al guardar.
- El botón de seguimiento y el contenido del popover hacen `onPointerDown={(e) =>
  e.stopPropagation()}` para **no disparar el arrastre** de `@dnd-kit` (los `listeners` van en la
  raíz de la tarjeta).
- Ocultar el nombre del agente en la tarjeta para no-admin (`useHasRole("admin")`; siempre es él
  mismo — consistente con `/leads`).
- Formato de fecha en es-MX (día + mes corto). Comparación de vencimiento por fecha (sin hora).

### 4. Datos (`src/data/leadsApi.ts`)

Sin cambios de lógica: `LeadRow`/`LeadUpdate` heredan `next_contact_at` al regenerar los tipos;
`useUpdateLead` ya acepta patch genérico e invalida el query `["leads"]` (el tablero se refresca).

## Pruebas

- **Simulación RLS (SQL, impersonando JWT de agente)**: el agente puede `UPDATE` de `status`,
  `next_contact_at` y `notes` de un lead **propio** (permitido) y NO de uno **ajeno** (rechazado);
  reconfirma que la nueva columna queda cubierta por la política de UPDATE existente.
- **E2E Playwright (proyecto `chromium-agent`)**: `/pipeline` accesible (no 403); el agente ve sus
  tarjetas; abre el popover de seguimiento, fija un "próximo contacto" y verifica que persiste
  (badge visible tras recargar). Reutiliza el `agent.json` ya existente.
- **Build/typecheck**: `bun run build` OK y `tsc --noEmit` exit 0.

## Fuera de alcance

- Bitácora / historial de actividad por prospecto.
- Cambiar el conjunto de etapas (siguen siendo los 5 estatus de `lead.status`).
- Recordatorios o notificaciones automáticas por fecha de próximo contacto (posible futuro).
- Cambios al comportamiento del admin (sólo gana el resaltado de vencido y el editor de seguimiento,
  que son compartidos).
