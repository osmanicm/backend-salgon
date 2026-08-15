-- Página pública del evento (/e/{id}) + registro de invitados sin cuenta.
--
-- Antes: events y event_slots solo se leían con sesión (políticas `to authenticated`),
-- y event_registrations exigía user_id = auth.uid(), así que un visitante no podía
-- ni ver el evento ni apuntarse.

-- ── Lectura pública, solo de lo publicado ──────────────────────────────────
create policy "Events: anon read published"
  on public.events
  for select to anon
  using (status = 'Published'::public.event_status);

create policy "Slots: anon read published"
  on public.event_slots
  for select to anon
  using (
    exists (
      select 1 from public.events e
      where e.id = event_slots.event_id
        and e.status = 'Published'::public.event_status
    )
  );

-- ── Registro de invitados ─────────────────────────────────────────────────
alter table public.event_registrations alter column user_id drop not null;

alter table public.event_registrations
  add column if not exists guest_name  text,
  add column if not exists guest_email text,
  add column if not exists guest_phone text;

-- Un registro es de usuario de la app O de invitado; nunca ambos ni ninguno.
alter table public.event_registrations
  drop constraint if exists event_registrations_user_or_guest;

alter table public.event_registrations
  add constraint event_registrations_user_or_guest check (
    (user_id is not null and guest_name is null and guest_email is null)
    or (
      user_id is null
      and guest_name is not null and length(btrim(guest_name)) between 2 and 100
      and guest_email is not null and guest_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  );

-- El mismo correo no se apunta dos veces al mismo evento.
create unique index if not exists event_registrations_guest_unique
  on public.event_registrations (event_id, lower(guest_email))
  where guest_email is not null;

-- El visitante anónimo solo puede crear su propio registro pendiente, en un
-- evento publicado y con un horario que pertenezca a ese evento. No puede leer
-- ni modificar nada más: la aprobación la hace un admin desde la app.
create policy "Regs: anon guest insert pending"
  on public.event_registrations
  for insert to anon
  with check (
    user_id is null
    and status = 'Pending'::public.registration_status
    and exists (
      select 1 from public.events e
      where e.id = event_registrations.event_id
        and e.status = 'Published'::public.event_status
    )
    and (
      slot_id is null
      or exists (
        select 1 from public.event_slots s
        where s.id = event_registrations.slot_id
          and s.event_id = event_registrations.event_id
      )
    )
  );
