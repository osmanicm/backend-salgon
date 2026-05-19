
-- 1) Create event enums
create type public.event_type as enum ('Open House', 'PASS Anual', 'Capacitación', 'Reunión Comercial');
create type public.event_status as enum ('Published', 'Draft');
create type public.registration_status as enum ('Confirmed', 'Cancelled', 'Attended');

-- 2) Events table
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  image_url text,
  type public.event_type not null,
  status public.event_status not null default 'Draft',
  location text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  agenda jsonb not null default '[]'::jsonb,
  materials jsonb not null default '[]'::jsonb,
  highlighted boolean not null default false,
  related_property_id uuid references public.properties(id) on delete set null,
  author_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_status_idx on public.events(status);
create index events_type_idx on public.events(type);
create index events_starts_at_idx on public.events(starts_at);

-- 3) Time slots (mainly for Open House)
create table public.event_slots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  capacity integer,
  label text not null default '',
  created_at timestamptz not null default now()
);
create index event_slots_event_idx on public.event_slots(event_id);

-- 4) Registrations / RSVP
create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  slot_id uuid references public.event_slots(id) on delete cascade,
  user_id uuid not null,
  status public.registration_status not null default 'Confirmed',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index event_registrations_unique on public.event_registrations(event_id, user_id, coalesce(slot_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index event_registrations_user_idx on public.event_registrations(user_id);

-- 5) Triggers updated_at
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
create trigger event_registrations_set_updated_at before update on public.event_registrations for each row execute function public.set_updated_at();

-- 6) RLS
alter table public.events enable row level security;
alter table public.event_slots enable row level security;
alter table public.event_registrations enable row level security;

-- Events: admins all; authenticated read published
create policy "Events: admins all" on public.events for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Events: authenticated read published" on public.events for select to authenticated
  using (status = 'Published'::event_status or has_role(auth.uid(), 'admin'::app_role));

-- Slots: admins all; authenticated read slots of published events
create policy "Slots: admins all" on public.event_slots for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role)) with check (has_role(auth.uid(), 'admin'::app_role));
create policy "Slots: authenticated read" on public.event_slots for select to authenticated
  using (exists (select 1 from public.events e where e.id = event_slots.event_id and (e.status = 'Published'::event_status or has_role(auth.uid(), 'admin'::app_role))));

-- Registrations: users CRUD own; admins read all
create policy "Regs: read own or admin" on public.event_registrations for select to authenticated
  using (user_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role));
create policy "Regs: insert own" on public.event_registrations for insert to authenticated
  with check (user_id = auth.uid());
create policy "Regs: update own or admin" on public.event_registrations for update to authenticated
  using (user_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role));
create policy "Regs: delete own or admin" on public.event_registrations for delete to authenticated
  using (user_id = auth.uid() or has_role(auth.uid(), 'admin'::app_role));

-- 7) Migrate "Open House" demo post into events, then remove Open House from news enum
-- Move any existing Open House news rows into events as Published
insert into public.events (title, description, image_url, type, status, location, starts_at, highlighted, related_property_id, author_id, created_at)
select n.title, n.description, n.image_url, 'Open House'::event_type, 'Published'::event_status,
       coalesce((select p.location from public.properties p where p.id = n.related_property_id), ''),
       case when n.event_date is not null then (n.event_date::timestamp + time '10:00') at time zone 'America/Mexico_City' else null end,
       n.highlighted, n.related_property_id, n.author_id, n.created_at
  from public.news n
 where n.category = 'Open House'::news_category;

-- Delete migrated news rows
delete from public.news where category = 'Open House'::news_category;

-- Recreate news_category enum without 'Open House'
alter type public.news_category rename to news_category_old;
create type public.news_category as enum ('Nuevos Lanzamientos', 'Promociones', 'Bonos', 'Avisos Internos');
alter table public.news alter column category drop default;
alter table public.news alter column category type public.news_category using category::text::public.news_category;
alter table public.news alter column category set default 'Avisos Internos'::public.news_category;
drop type public.news_category_old;
