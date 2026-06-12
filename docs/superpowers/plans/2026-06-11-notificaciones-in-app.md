# Notificaciones in-app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sistema de notificaciones in-app: cuando ocurren ciertos eventos (nueva propiedad, disponible, modificada, evento/noticia publicados) se notifica a todos los agentes, visible en la campana de la Topbar.

**Architecture:** Una tabla `notifications` + RLS + un helper `notify_all_agents` y 3 triggers productores (properties/events/news) en una migración. Capa de datos React Query (`notificationsApi.ts`, polling 60s). UI: `NotificationsBell.tsx` (Popover) reemplaza el botón decorativo de la campana. La venta NO notifica.

**Tech Stack:** Supabase Postgres (RLS + plpgsql triggers `SECURITY DEFINER`), TanStack Router/Query, shadcn `Popover`/`ScrollArea`, `date-fns` (locale `es`), Cloudflare Workers.

**Spec de referencia:** `docs/superpowers/specs/2026-06-11-notificaciones-in-app-design.md`

**Nota de testing:** El proyecto NO tiene runner de unit tests (solo Playwright E2E como admin + verificación manual). La verificación es: confirmar tabla/políticas/triggers vía SQL, probar cada productor con SQL transaccional (rollback), `tsc`/`eslint`, y prueba manual en la app.

**⚠️ Entorno:** Un solo proyecto Supabase (`hlqmfwqeildvbokawngt`); aplicar la migración impacta **producción**. Se versiona el archivo y se aplica con verificación.

---

## File Structure

- **Create:** `supabase/migrations/20260611203000_notifications.sql` — tabla + RLS + helper + 3 triggers.
- **Modify:** `src/integrations/supabase/types.ts` — regenerar para incluir `notifications`.
- **Create:** `src/data/notificationsApi.ts` — hooks React Query.
- **Create:** `src/components/layout/NotificationsBell.tsx` — campana funcional (Popover).
- **Modify:** `src/components/layout/Topbar.tsx:61-64` — reemplazar botón decorativo por `<NotificationsBell />` y limpiar import `Bell`.

---

### Task 1: Migración — tabla, RLS, helper y triggers

**Files:**
- Create: `supabase/migrations/20260611203000_notifications.sql`

- [ ] **Step 1: Escribir la migración completa**

Crear `supabase/migrations/20260611203000_notifications.sql` con exactamente:

```sql
-- In-app notifications system
-- Tabla genérica + RLS + helper notify_all_agents + triggers productores
-- (properties / events / news). Notifica a todos los agentes. La venta NO notifica.

-- ============================================================
-- 1) Tabla notifications
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_unread_idx on public.notifications(recipient_id, read_at);
create index notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);

alter table public.notifications enable row level security;

create policy "Notifications: read own" on public.notifications
  for select to authenticated
  using (recipient_id = auth.uid());

create policy "Notifications: update own" on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- ============================================================
-- 2) Helper: una notificación por cada agente
-- ============================================================
create or replace function public.notify_all_agents(p_type text, p_title text, p_body text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, type, title, body, data)
  select ur.user_id, p_type, p_title, p_body, coalesce(p_data, '{}'::jsonb)
  from public.user_roles ur
  where ur.role = 'agent'::public.app_role;
end;
$$;

-- ============================================================
-- 3) Trigger productor: properties
-- ============================================================
create or replace function public.tg_notify_property()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
begin
  v_body := NEW.title || ' (Modelo ' || coalesce(NEW.model, '-') || ' · Lote ' || coalesce(NEW.lot, '-') || ')';

  if TG_OP = 'INSERT' then
    perform public.notify_all_agents(
      'property_added', 'Nueva propiedad', 'Se agregó: ' || v_body,
      jsonb_build_object('href', '/properties', 'entity_id', NEW.id)
    );
    return NEW;
  end if;

  -- UPDATE (precedencia)
  if NEW.status = 'Available' and OLD.status is distinct from 'Available' then
    perform public.notify_all_agents(
      'property_available', 'Propiedad disponible', 'Ya está disponible: ' || v_body,
      jsonb_build_object('href', '/properties', 'entity_id', NEW.id)
    );
    return NEW;
  end if;

  if NEW.status = 'Sold' and OLD.status is distinct from 'Sold' then
    return NEW; -- ventas no notifican
  end if;

  if NEW.price is distinct from OLD.price or NEW.status is distinct from OLD.status then
    perform public.notify_all_agents(
      'property_modified', 'Propiedad actualizada', 'Se modificó: ' || v_body,
      jsonb_build_object('href', '/properties', 'entity_id', NEW.id)
    );
  end if;

  return NEW;
end;
$$;

create trigger notify_property_changes
  after insert or update on public.properties
  for each row execute function public.tg_notify_property();

-- ============================================================
-- 4) Trigger productor: events (al publicar)
-- ============================================================
create or replace function public.tg_notify_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT' and NEW.status = 'Published')
     or (TG_OP = 'UPDATE' and NEW.status = 'Published' and OLD.status is distinct from 'Published') then
    perform public.notify_all_agents(
      'event_published', 'Nuevo evento', NEW.title,
      jsonb_build_object('href', '/events', 'entity_id', NEW.id)
    );
  end if;
  return NEW;
end;
$$;

create trigger notify_event_published
  after insert or update on public.events
  for each row execute function public.tg_notify_event();

-- ============================================================
-- 5) Trigger productor: news (al publicar)
-- ============================================================
create or replace function public.tg_notify_news()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT' and NEW.status = 'Published')
     or (TG_OP = 'UPDATE' and NEW.status = 'Published' and OLD.status is distinct from 'Published') then
    perform public.notify_all_agents(
      'news_published', 'Nueva noticia', NEW.title,
      jsonb_build_object('href', '/news', 'entity_id', NEW.id)
    );
  end if;
  return NEW;
end;
$$;

create trigger notify_news_published
  after insert or update on public.news
  for each row execute function public.tg_notify_news();
```

- [ ] **Step 2: Revisión de sintaxis (lectura)**

Confirmar: la tabla y 2 políticas; `notify_all_agents` filtra `role = 'agent'::public.app_role`; el trigger de properties tiene la precedencia available→sold(return)→modified; events/news disparan solo al publicar; cada `create trigger` referencia su función.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260611203000_notifications.sql
git commit -m "feat(notifications): tabla, RLS y triggers productores"
```

---

### Task 2: Aplicar la migración a Supabase (controlador)

**Files:**
- (aplica el SQL de Task 1 a la base remota)

- [ ] **Step 1: Aplicar**

Usar MCP Supabase `apply_migration` con `project_id = hlqmfwqeildvbokawngt`, `name = notifications`, `query` = contenido completo del archivo de Task 1.
Expected: `{"success": true}`.

- [ ] **Step 2: Verificar objetos creados**

MCP `execute_sql` (mismo project_id):
```sql
select 'policy' as kind, policyname as name from pg_policies where tablename = 'notifications'
union all
select 'trigger', tgname from pg_trigger
  where tgrelid in ('public.properties'::regclass,'public.events'::regclass,'public.news'::regclass)
  and tgname in ('notify_property_changes','notify_event_published','notify_news_published')
order by 1, 2;
```
Expected: 2 policies (`Notifications: read own`, `Notifications: update own`) y 3 triggers (`notify_event_published`, `notify_news_published`, `notify_property_changes`).

---

### Task 3: Regenerar tipos de Supabase (controlador)

**Files:**
- Modify: `src/integrations/supabase/types.ts`

- [ ] **Step 1: Generar tipos**

Usar MCP Supabase `generate_typescript_types` con `project_id = hlqmfwqeildvbokawngt` y sobrescribir `src/integrations/supabase/types.ts` con el resultado.

- [ ] **Step 2: Verificar que `notifications` quedó en los tipos**

Run: `grep -c "notifications" src/integrations/supabase/types.ts`
Expected: > 0.

- [ ] **Step 3: Type-check + commit**

Run: `node_modules/.bin/tsc --noEmit`
Expected: sin errores.
```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(types): regenerar tipos Supabase con notifications"
```

---

### Task 4: Capa de datos — `notificationsApi.ts`

**Files:**
- Create: `src/data/notificationsApi.ts`

- [ ] **Step 1: Crear el archivo**

Crear `src/data/notificationsApi.ts` con exactamente:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type NotificationRow = Tables<"notifications">;

const KEY = ["notifications"] as const;

export function useNotifications() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<NotificationRow[]> => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .is("read_at", null);
      if (error) throw error;
      return id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
```

- [ ] **Step 2: Type-check**

Run: `node_modules/.bin/tsc --noEmit`
Expected: sin errores (requiere que Task 3 ya haya regenerado los tipos).

- [ ] **Step 3: Commit**

```bash
git add src/data/notificationsApi.ts
git commit -m "feat(notifications): hooks de datos (lista, marcar leído)"
```

---

### Task 5: UI — campana funcional + wiring en Topbar

**Files:**
- Create: `src/components/layout/NotificationsBell.tsx`
- Modify: `src/components/layout/Topbar.tsx`

- [ ] **Step 1: Crear `NotificationsBell.tsx`**

Crear `src/components/layout/NotificationsBell.tsx` con exactamente:

```tsx
import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  type NotificationRow,
} from "@/data/notificationsApi";

export function NotificationsBell() {
  const { data: items = [] } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const unread = items.filter((n) => !n.read_at).length;

  function handleClick(n: NotificationRow) {
    if (!n.read_at) markRead.mutate(n.id);
    const href = (n.data as { href?: string } | null)?.href;
    if (href) {
      setOpen(false);
      navigate({ to: href });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative h-9 w-9 grid place-items-center rounded-full hover:bg-muted"
          aria-label="Notificaciones"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-gold text-[10px] font-bold text-background grid place-items-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">Notificaciones</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => markAll.mutate()}>
              <CheckCheck className="h-3.5 w-3.5" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">Sin notificaciones</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors",
                      !n.read_at && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      <div className={cn("min-w-0 flex-1", n.read_at && "pl-4")}>
                        <div className="text-sm font-medium truncate">{n.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Reemplazar el botón decorativo en `Topbar.tsx`**

En `src/components/layout/Topbar.tsx`, reemplazar este bloque (líneas ~61-64):

```tsx
            <button className="relative h-9 w-9 grid place-items-center rounded-full hover:bg-muted">
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-gold" />
            </button>
```

por:

```tsx
            <NotificationsBell />
```

- [ ] **Step 3: Ajustar imports en `Topbar.tsx`**

`Bell` ya no se usa en Topbar (lo usa internamente `NotificationsBell`). Cambiar la línea 1:

```tsx
import { Bell, Search, LogOut, User } from "lucide-react";
```

por:

```tsx
import { Search, LogOut, User } from "lucide-react";
```

Y añadir el import del nuevo componente junto a los demás imports de layout (debajo de `import { CommandPalette } from "@/components/layout/CommandPalette";`):

```tsx
import { NotificationsBell } from "@/components/layout/NotificationsBell";
```

- [ ] **Step 4: Type-check + lint**

Run: `node_modules/.bin/tsc --noEmit`
Expected: sin errores.
Run: `node_modules/.bin/eslint src/components/layout/NotificationsBell.tsx src/components/layout/Topbar.tsx`
Expected: sin errores nuevos (warnings CRLF `␍` preexistentes son aceptables).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/NotificationsBell.tsx src/components/layout/Topbar.tsx
git commit -m "feat(notifications): campana funcional en la Topbar"
```

---

### Task 6: Verificación de productores (controlador) + manual

**Files:**
- (verificación SQL vía MCP + prueba manual en la app)

- [ ] **Step 1: Verificar cada productor con SQL transaccional (rollback)**

Ejecutar (MCP `execute_sql`, `project_id = hlqmfwqeildvbokawngt`). Cuenta notificaciones generadas dentro de una transacción que se revierte, así no deja datos:

```sql
do $$
declare
  v_prop uuid;
  v_added int; v_avail int; v_sold int; v_mod int;
  v_agents int;
begin
  select count(*) into v_agents from public.user_roles where role = 'agent'::public.app_role;

  -- INSERT propiedad → property_added
  insert into public.properties (code, title, price, location, status)
  values ('P-NOTIF-TEST', 'Casa Prueba', 1000000, 'Test', 'Reserved')
  returning id into v_prop;
  select count(*) into v_added from public.notifications where type='property_added' and (data->>'entity_id')::uuid = v_prop;

  -- UPDATE → Available
  update public.properties set status='Available' where id=v_prop;
  select count(*) into v_avail from public.notifications where type='property_available' and (data->>'entity_id')::uuid = v_prop;

  -- UPDATE → Sold (no notifica)
  update public.properties set status='Sold' where id=v_prop;
  select count(*) into v_sold from public.notifications where type='property_modified' and (data->>'entity_id')::uuid = v_prop;

  -- UPDATE precio (vuelvo a no-vendida primero, luego cambio precio)
  update public.properties set status='Reserved' where id=v_prop;
  update public.properties set price=2000000 where id=v_prop;
  select count(*) into v_mod from public.notifications where type='property_modified' and (data->>'entity_id')::uuid = v_prop;

  raise notice 'agents=%, added=% (esp %), available=% (esp %), sold_as_modified=% (esp 0), modified=% (>=%)',
    v_agents, v_added, v_agents, v_avail, v_agents, v_sold, v_mod, v_agents;
  rollback;
end $$;
```
Expected (en el NOTICE): `added` y `available` = número de agentes; `sold_as_modified` = 0 (la venta no generó `property_modified`); `modified` ≥ número de agentes (el cambio Sold→Reserved y/o el cambio de precio generaron `property_modified`). La transacción hace rollback (no deja datos de prueba).

> Nota: si Postgres marca error por el `rollback` dentro del `do` block en este MCP, usar en su lugar `raise exception 'rollback de prueba'` al final para abortar sin dejar datos, e ignorar ese error esperado.

- [ ] **Step 2: Verificación manual en la app**

Run: `bun run dev`
- Como **admin** (`inmobiliariasalgon@gmail.com`): publicar una noticia (o evento) y crear/editar una propiedad (precio o estatus).
- Como **agente** (`osmanicm@gmail.com`, en otra sesión/navegador): la campana muestra el badge de no-leídas y las notificaciones correctas; al hacer clic se marca leída y navega; "Marcar todas" limpia el badge.
- Confirmar que **vender** una propiedad NO generó notificación y que una noticia en **borrador** tampoco.

---

## Self-Review

**Spec coverage:**
- Tabla `notifications` + RLS (read/update own, insert solo trigger) → Task 1 sección 1.
- Helper `notify_all_agents` → Task 1 sección 2.
- Productores: property_added/available/modified con precedencia y venta-sin-notif → Task 1 sección 3.
- event_published / news_published al publicar → Task 1 secciones 4-5.
- Tipos Supabase → Task 3.
- `notificationsApi.ts` (lista polling, marcar leído/todas) → Task 4.
- `NotificationsBell.tsx` + reemplazo del botón decorativo → Task 5.
- Pruebas por productor + manual → Task 6.

**Placeholder scan:** Sin TBD/TODO; SQL, TS y TSX completos. ✅

**Type/identifier consistency:** `NotificationRow`, hooks `useNotifications`/`useMarkNotificationRead`/`useMarkAllNotificationsRead`, tipos de notificación (`property_added`, `property_available`, `property_modified`, `event_published`, `news_published`), `data.href`, nombres de trigger/función consistentes entre tasks. `Bell` se elimina de Topbar y se usa dentro de `NotificationsBell`. ✅

Sin huecos detectados.
