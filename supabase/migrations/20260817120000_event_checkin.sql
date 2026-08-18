-- Check-in de eventos: cada inscripción lleva un token secreto que viaja dentro
-- de su QR personal, más la marca de entrada.
--
-- El token es el único secreto del sistema, así que se genera con dos UUID v4
-- concatenados (64 caracteres hex, sin extensiones extra) y va indexado como
-- único. La RLS de event_registrations no cambia: `anon` no puede leer la tabla,
-- y el check-in ocurre en el servidor con la llave de servicio.
alter table public.event_registrations
  add column if not exists checkin_token text,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references public.profiles(id) on delete set null;

-- Las inscripciones que ya existían también necesitan su pase.
update public.event_registrations
set checkin_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
where checkin_token is null;

alter table public.event_registrations
  alter column checkin_token set default
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  alter column checkin_token set not null;

create unique index if not exists event_registrations_checkin_token_key
  on public.event_registrations (checkin_token);
