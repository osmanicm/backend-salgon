# Diseño: Prospectos visibles y administrables para agentes

**Fecha:** 2026-07-30
**Estado:** Aprobado
**Rama:** `feat/leads-agent-access`

## Objetivo

Permitir que un **agente** acceda a la vista de Prospectos (`/leads`, UI: "Prospectos") y
realice **CRUD completo (crear, editar, eliminar) únicamente sobre SUS propios prospectos**.
Un agente no puede ver ni tocar los prospectos de otros agentes, ni reasignar un lead a otro
agente. El **admin** conserva el acceso total, sin cambios de comportamiento.

## Contexto / estado actual

- La ruta `/leads` existe y es funcional (`src/routes/leads.tsx`, datos en `src/data/leadsApi.ts`).
- **RLS ya acotado por dueño**: las 4 políticas de `public.leads` usan
  `agent_id = auth.uid() OR public.has_role(auth.uid(),'admin')` para SELECT/INSERT/UPDATE/DELETE
  (migración `20260506201602_...sql`, verificado en producción vía `pg_policies`).
- **Bloqueo actual**: `/leads` está en `ADMIN_ONLY_PATHS` (`src/components/layout/AppShell.tsx`),
  por lo que los agentes ven una pantalla 403 (`ForbiddenScreen`) antes de llegar a la vista.
- La navegación se filtra por rol: `agentNav` (Sidebar) y `agentTabs` (BottomNav) no incluyen
  "Prospectos". La página `/more` filtra ítems por `adminOnly`.
- El formulario de lead (`LeadFormDialogContent`) muestra un selector "Agente asignado" que lista
  todos los agentes vía `useAgentsList()`.

## Decisiones de producto

- **Alcance del agente:** CRUD completo sobre sus propios prospectos (crear + editar + eliminar).
- **Reasignación:** un agente NO puede reasignar un lead a otro agente. Sólo el admin reasigna.

## Cambios

### 1. Base de datos (RLS) — CERO cambios

Las políticas ya cumplen el requisito. Además, la política de UPDATE **no** define `WITH CHECK`
explícito; en PostgreSQL, cuando se omite `WITH CHECK` en una policy de UPDATE, la expresión
`USING` se aplica también a la fila **nueva**. Por lo tanto un agente no puede cambiar `agent_id`
a otro usuario ni por API directa (la fila resultante debe seguir cumpliendo
`agent_id = auth.uid()`). No hay migración.

### 2. Quitar el candado de ruta

`src/components/layout/AppShell.tsx`: remover `"/leads"` de `ADMIN_ONLY_PATHS`. El RLS filtra los
datos; los agentes inactivos siguen bloqueados por `PendingActivationScreen` (sin cambio).

### 3. Navegación (hacer visible "Prospectos" a agentes)

- `src/components/layout/Sidebar.tsx` (`agentNav`): agregar
  `{ to: "/leads", label: "Prospectos", icon: Users }` después de "Propiedades".
- `src/components/layout/BottomNav.tsx` (`agentTabs`): intercambiar "Eventos" por "Prospectos"
  (Prospectos es herramienta diaria del CRM; Eventos queda accesible desde "Más").
- `src/routes/more.tsx`: agregar "Prospectos" a la sección *Operaciones* (sin `adminOnly`), de modo
  que Eventos y Prospectos sean ambos alcanzables en móvil.

### 4. Formulario de lead por rol (`src/routes/leads.tsx`)

- **Admin:** sin cambios — conserva el selector "Agente asignado".
- **Agente:** ocultar el selector; `agent_id` se fuerza a `user.id` al crear y se conserva al
  editar. El schema Zod ya exige `agent_id`; se llena automáticamente con el id del usuario.

### 5. Ajustes de UI menores para agentes (`src/routes/leads.tsx`)

- Ocultar la columna "Agente" (tabla desktop) y la línea "Agente · …" (card móvil) cuando el
  usuario no es admin (para un agente siempre es él mismo).
- Encabezado condicional: "Mis Prospectos" (agente) / "Todos los Prospectos" (admin).

### 6. Notificaciones — sin cambio

`notifyNewLead` sigue enviando correo a `ADMIN_EMAIL` cuando se crea un lead (deseable: el admin se
entera de nuevos prospectos, sin importar quién los cree).

## Pruebas

- **Verificación RLS por simulación SQL** (impersonando JWT de un agente): confirmar que un agente
  sólo ve/edita/borra los suyos; que un INSERT con `agent_id` ajeno es rechazado (42501); y que un
  UPDATE que intente cambiar `agent_id` a otro usuario es rechazado. Mismo patrón usado en features
  previas (visibilidad de propiedades, notificaciones).
- **E2E Playwright (cuenta agente):** `/leads` accesible (no 403); sólo aparecen los prospectos del
  agente; el formulario de creación NO muestra el selector "Agente asignado"; un prospecto creado
  por el agente queda asignado a sí mismo.
- **Verificación de build:** `bun run build` OK y `tsc --noEmit` exit 0.

## Fuera de alcance

- Renombrar el archivo de ruta `/leads` a `/prospectos` (rompería enlaces internos, no aporta al
  objetivo; la UI ya está en español).
- Cambios al comportamiento del admin.
- Endurecer RLS por `is_active` (queda como opción futura, ya anotada en el estado del proyecto).
