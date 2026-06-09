-- ============================================
-- USER ACTIVATION (admin must validate users)
-- ============================================

-- 1) is_active flag on profiles (deactivated by default)
alter table public.profiles
  add column if not exists is_active boolean not null default false;

-- 2) Existing data: admins active, everyone else stays deactivated.
update public.profiles p
set is_active = true
where exists (
  select 1 from public.user_roles r
  where r.user_id = p.id and r.role = 'admin'
);

-- 3) New signups: first user (admin) active, everyone else deactivated.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_first boolean;
begin
  v_is_first := (select count(*) from public.user_roles) = 0;

  insert into public.profiles (id, full_name, email, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    v_is_first
  );

  if v_is_first then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'agent');
  end if;

  return new;
end;
$$;

-- 4) Guard: only admins can change is_active; admins always stay active.
--    Service-role calls (auth.uid() is null) are trusted server-side actions.
create or replace function public.protect_is_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.is_active is distinct from OLD.is_active then
    if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then
      raise exception 'Solo un administrador puede cambiar el estado de activación';
    end if;
  end if;

  -- Admins must always remain active.
  if public.has_role(NEW.id, 'admin') then
    NEW.is_active := true;
  end if;

  return NEW;
end;
$$;

drop trigger if exists profiles_protect_is_active on public.profiles;
create trigger profiles_protect_is_active
  before update on public.profiles
  for each row execute function public.protect_is_active();
