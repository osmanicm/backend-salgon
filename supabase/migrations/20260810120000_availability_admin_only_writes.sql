-- Disponibilidad: escritura solo para admin.
--
-- Antes: cualquier usuario autenticado podía insertar/actualizar/eliminar lotes
-- (políticas "Availability: authenticated insert/update/delete"), lo que permitía a
-- un agente crear lotes, actualizar en lote, marcar vendido, editar o eliminar
-- —y, por el trigger de sincronización, alterar indirectamente las propiedades,
-- que ya son admin-only desde 20260611201500.
--
-- Ahora: los agentes conservan solo lectura (matriz + PDF de disponibilidad).

drop policy if exists "Availability: authenticated insert" on public.availability_units;
drop policy if exists "Availability: authenticated update" on public.availability_units;
drop policy if exists "Availability: authenticated delete" on public.availability_units;

create policy "Availability: admin insert"
  on public.availability_units
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Availability: admin update"
  on public.availability_units
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Availability: admin delete"
  on public.availability_units
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));
