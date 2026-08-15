-- Estatus "Pendiente" para los registros de invitados que llegan desde la página
-- pública del evento y esperan aprobación de Inmobiliaria Salgon.
--
-- Va en su propia migración: Postgres no permite USAR un valor de enum en la
-- misma transacción en que se agrega, y la siguiente migración lo referencia en
-- las políticas de RLS.
alter type public.registration_status add value if not exists 'Pending';
