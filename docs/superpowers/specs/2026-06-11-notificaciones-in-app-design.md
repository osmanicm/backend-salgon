# Diseño — Subproyecto #2: Notificaciones in-app

**Fecha:** 2026-06-11
**Estado:** Diseño aprobado → pasar a plan de implementación.
**Contexto:** Parte 2 de 2. El #1 (visibilidad/permisos de propiedades) ya está en producción. Hoy la campana de la Topbar (`Topbar.tsx:61-64`) es **decorativa** (botón sin `onClick`, puntito fijo); no existe ningún sistema de notificaciones.

## Objetivo

Construir un sistema de notificaciones in-app (campana de la Topbar) que avise a **todos los agentes** cuando ocurre alguno de estos eventos:
1. Se agregó una propiedad nueva.
2. Una propiedad pasó a Disponible.
3. Se modificó una propiedad (solo precio o estatus).
4. Se publicó un evento.
5. Se publicó una noticia.

La **venta** de una propiedad NO genera notificación (decisión de producto).

## Decisiones (brainstorming 2026-06-11)

| Decisión | Elección |
|----------|----------|
| Destinatarios | **Todos los agentes** (usuarios con rol `agent`) |
| Frescura de la campana | **Refetch/polling** (React Query); el proyecto no usa realtime |
| Productor | **Triggers de BD** `SECURITY DEFINER` (robustos; disparan venga de la UI o SQL) |
| "Modificada" | Solo si cambia **precio o estatus** (evita spam) |
| Eventos/noticias | Notificar **al publicar** (no en borrador) |
| Venta | **No notifica** |
| Navegación | Informativa; clic marca leída y navega a la lista relevante si hay `data.href` |

## Hechos verificados (esquema actual)

- `properties`: columnas `title, model, lot, price numeric, status property_status('Available'|'Reserved'|'Sold'), code`.
- `events`: `title text`, `status public.event_status ('Published'|'Draft')`.
- `news`: tabla propia con `status` ('Published'|'Draft') y `title` (gestionada vía `newsApi.ts`).
- `user_roles(user_id, role app_role)`; función `public.has_role(uuid, app_role)`. Agentes = filas con `role = 'agent'`.
- `profiles.id` = id del usuario de auth (FK para `recipient_id`).
- La app usa React Query en todos lados; **no hay suscripciones realtime** en el código.

## A) Modelo de datos — tabla `notifications`

```sql
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,            -- 'property_added' | 'property_available' | 'property_modified' | 'event_published' | 'news_published'
  title text not null,
  body text not null,            -- autocontenido (snapshot del título/modelo/lote)
  data jsonb not null default '{}'::jsonb,  -- { href?: string, entity_id?: uuid }
  read_at timestamptz,           -- null = no leída
  created_at timestamptz not null default now()
);
create index notifications_recipient_unread_idx on public.notifications(recipient_id, read_at);
create index notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);
alter table public.notifications enable row level security;
```

RLS:
- SELECT: `recipient_id = auth.uid()`.
- UPDATE: `recipient_id = auth.uid()` (para marcar `read_at`).
- **Sin** política de INSERT para `authenticated`: las inserciones las hace solo el trigger `SECURITY DEFINER`.
- Sin DELETE en v1.

## B) Productores — función helper + triggers

Función helper `SECURITY DEFINER` que inserta una notificación por cada agente:
```sql
create or replace function public.notify_all_agents(p_type text, p_title text, p_body text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
  insert into public.notifications (recipient_id, type, title, body, data)
  select ur.user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from public.user_roles ur
  where ur.role = 'agent'::public.app_role;
$$;
```

### Trigger en `properties` (AFTER INSERT OR UPDATE)
Precedencia (evita duplicados y excluye ventas):
- INSERT → `property_added`: "Nueva propiedad: «title» (Modelo «model» · Lote «lot»)", `data.href='/properties'`.
- UPDATE:
  1. `NEW.status='Available' AND OLD.status IS DISTINCT FROM 'Available'` → `property_available` y `return`.
  2. `NEW.status='Sold' AND OLD.status IS DISTINCT FROM 'Sold'` → `return` (no notifica).
  3. `NEW.price IS DISTINCT FROM OLD.price OR NEW.status IS DISTINCT FROM OLD.status` → `property_modified`.
  4. else → `return`.

### Trigger en `events` (AFTER INSERT OR UPDATE)
Dispara `event_published` ("Nuevo evento: «title»", `data.href='/events'`) cuando:
- INSERT con `status='Published'`, o
- UPDATE con `NEW.status='Published' AND OLD.status IS DISTINCT FROM 'Published'`.

### Trigger en `news` (AFTER INSERT OR UPDATE)
Igual patrón → `news_published` ("Nueva noticia: «title»", `data.href='/news'`):
- INSERT con `status='Published'`, o
- UPDATE con `NEW.status='Published' AND OLD.status IS DISTINCT FROM 'Published'`.

Todo en una sola migración `<timestamp>_notifications.sql` (tabla + RLS + función helper + 3 funciones de trigger + 3 triggers).

## C) Capa de datos — `src/data/notificationsApi.ts`

```ts
export type NotificationRow = Tables<"notifications">;
```
- `useNotifications()` — `select * from notifications order by created_at desc limit 30`; `refetchInterval: 60_000`, `refetchOnWindowFocus: true`.
- `useMarkRead()` — mutation: `update notifications set read_at = now() where id = $id and read_at is null`; invalida la query.
- `useMarkAllRead()` — mutation: `update notifications set read_at = now() where recipient_id = auth.uid() and read_at is null`; invalida.
- No-leídas = `data.filter(n => !n.read_at).length` (badge con tope "9+").

Regenerar tipos de Supabase tras la migración (`Tables<"notifications">`).

## D) UI — `src/components/layout/NotificationsBell.tsx`

- Reemplaza el `<button>` decorativo de `Topbar.tsx:61-64`.
- Campana con badge de no-leídas (oculto si 0).
- `Popover` (shadcn) con: encabezado + "Marcar todas como leídas" (si hay no-leídas); lista de hasta 30 (título, body, tiempo relativo es-MX); no-leídas con fondo resaltado; estado vacío "Sin notificaciones".
- Clic en una notificación → `useMarkRead(id)` y, si `data.href`, `navigate({ to: data.href })` y cierra el popover.
- Visible para todos; hoy solo los agentes reciben (admins la verán vacía).

## E) Pruebas

- **Por productor (SQL en transacción con rollback):**
  - Insert de propiedad → 1 notificación `property_added` por agente.
  - Update status → 'Available' → `property_available`; status → 'Sold' → **ninguna**; cambio de precio → `property_modified`; cambio de campo no-relevante (p.ej. `title`) → **ninguna**.
  - Insert/Update de `events`/`news` a 'Published' → `event_published`/`news_published`; quedar en 'Draft' → **ninguna**.
- **Manual:** admin crea/edita en cada tabla → el agente ve el badge y las notificaciones; clic marca leída y navega; "marcar todas" limpia el badge. Admin no recibe.

## Fuera de alcance (YAGNI)

Realtime, email, preferencias por usuario, borrar/archivar, notificar a admins, agrupar/colapsar, paginación más allá de 30.
