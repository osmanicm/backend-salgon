
-- ============================================
-- 1. ROLES SYSTEM (avoid privilege escalation)
-- ============================================
create type public.app_role as enum ('admin', 'agent');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

-- ============================================
-- 2. PROFILES TABLE
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  -- First-ever user becomes admin; everyone else defaults to agent.
  if (select count(*) from public.user_roles) = 0 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'agent');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================
-- 3. PROPERTIES TABLE
-- ============================================
create type public.property_status as enum ('Available', 'Reserved', 'Sold');

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  price numeric not null check (price >= 0),
  location text not null,
  status property_status not null default 'Available',
  agent_id uuid references public.profiles(id) on delete set null,
  bedrooms int not null default 0 check (bedrooms >= 0),
  bathrooms int not null default 0 check (bathrooms >= 0),
  area numeric not null default 0 check (area >= 0),
  image_url text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_properties_status on public.properties(status) where deleted_at is null;
create index idx_properties_agent on public.properties(agent_id) where deleted_at is null;

alter table public.properties enable row level security;

create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- ============================================
-- 4. RLS POLICIES
-- ============================================

-- profiles
create policy "Profiles: users read own"
  on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));

create policy "Profiles: users update own"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "Profiles: admins update all"
  on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- user_roles
create policy "Roles: users read own"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Roles: admins write"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- properties
create policy "Properties: authenticated read non-deleted"
  on public.properties for select to authenticated
  using (deleted_at is null or public.has_role(auth.uid(), 'admin'));

create policy "Properties: authenticated insert"
  on public.properties for insert to authenticated
  with check (auth.uid() is not null);

create policy "Properties: agent or admin update"
  on public.properties for update to authenticated
  using (agent_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "Properties: agent or admin delete"
  on public.properties for delete to authenticated
  using (agent_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- ============================================
-- 5. SEED PROPERTIES (agent_id null until users exist)
-- ============================================
insert into public.properties (code, title, price, location, status, bedrooms, bathrooms, area, image_url, created_at) values
  ('P-1024', 'Penthouse Vista al Mar',                12500000, 'CDMX, Polanco',                  'Available', 4, 3, 280, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800', '2025-03-12'),
  ('P-1025', 'Loft Moderno Centro',                    5800000, 'CDMX, Roma Norte',               'Reserved',  2, 2, 140, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800', '2025-03-15'),
  ('P-1026', 'Villa de Montaña Valle de Bravo',       17500000, 'Valle de Bravo, Edo. Méx.',      'Available', 5, 4, 420, 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800', '2025-02-28'),
  ('P-1027', 'Departamento Familiar Coyoacán',         4450000, 'CDMX, Coyoacán',                 'Sold',      3, 2, 175, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800', '2025-02-14'),
  ('P-1028', 'Casa Frente al Mar Playa del Carmen',    7400000, 'Playa del Carmen, Q. Roo',       'Available', 3, 2, 160, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800', '2025-04-01'),
  ('P-1029', 'Estudio Acogedor Condesa',               2450000, 'CDMX, Condesa',                  'Reserved',  1, 1, 65,  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800', '2025-03-20'),
  ('P-1030', 'Townhouse con Jardín Lomas',             9500000, 'CDMX, Lomas de Chapultepec',     'Available', 4, 3, 310, 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800', '2025-04-05'),
  ('P-1031', 'Penthouse con Terraza Del Valle',        6800000, 'CDMX, Del Valle',                'Sold',      2, 2, 130, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800', '2025-01-22');
