-- ============================================
-- PRIVACY NOTICE ACCEPTANCES
-- Registro inmutable de aceptación del Aviso de Privacidad por usuario y versión.
-- ============================================

create table if not exists public.privacy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version text not null,
  user_agent text,
  accepted_at timestamptz not null default now()
);

create index if not exists privacy_acceptances_user_id_idx
  on public.privacy_acceptances (user_id);

-- Re-aceptar la misma versión es idempotente.
create unique index if not exists privacy_acceptances_user_version_uniq
  on public.privacy_acceptances (user_id, version);

alter table public.privacy_acceptances enable row level security;

-- Lectura: cada quien la suya; los admins ven todo (auditoría).
drop policy if exists "Privacy: own select" on public.privacy_acceptances;
create policy "Privacy: own select"
  on public.privacy_acceptances for select
  using (user_id = auth.uid());

drop policy if exists "Privacy: admin select" on public.privacy_acceptances;
create policy "Privacy: admin select"
  on public.privacy_acceptances for select
  using (public.has_role(auth.uid(), 'admin'));

-- Inserción: solo la propia aceptación del usuario autenticado.
drop policy if exists "Privacy: own insert" on public.privacy_acceptances;
create policy "Privacy: own insert"
  on public.privacy_acceptances for insert
  with check (user_id = auth.uid());

-- Sin políticas de update/delete: el registro es inmutable.
