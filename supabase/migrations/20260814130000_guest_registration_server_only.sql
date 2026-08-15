-- El alta de invitados dejó de escribirse desde el navegador: ahora pasa por la
-- server function `registerEventGuest`, que filtra bots (honeypot + tiempo mínimo
-- + Turnstile) y escribe con la llave de servicio, revalidando que el evento esté
-- publicado y que el horario sea de ese evento.
--
-- Con eso, la política que permitía a `anon` insertar sobra y deja la tabla
-- cerrada a escritura anónima. La lectura pública de events/event_slots no cambia.
drop policy if exists "Regs: anon guest insert pending" on public.event_registrations;
