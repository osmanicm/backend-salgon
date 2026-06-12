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
