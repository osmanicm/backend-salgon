-- Properties: visibility & permissions
-- Agentes pasan a solo-lectura en propiedades. Las propiedades vendidas (y su
-- media, archivos y citas) se vuelven invisibles para los agentes. Los admins
-- ven y gestionan todo.

-- ============================================================
-- A) Properties: escritura admin-only
-- ============================================================
drop policy if exists "Properties: authenticated insert" on public.properties;
drop policy if exists "Properties: agent or admin update" on public.properties;
drop policy if exists "Properties: agent or admin delete" on public.properties;

create policy "Properties: admin insert" on public.properties
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Properties: admin update" on public.properties
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Properties: admin delete" on public.properties
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- B) Properties: agentes no leen vendidas (ni eliminadas); admin lee todo
-- ============================================================
drop policy if exists "Properties: authenticated read non-deleted" on public.properties;
create policy "Properties: read non-deleted, agents exclude sold" on public.properties
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or (deleted_at is null and status <> 'Sold')
  );

-- ============================================================
-- C) property_media / property_files: ocultar las de vendidas a agentes
-- ============================================================
drop policy if exists "Media: authenticated read non-deleted" on public.property_media;
create policy "Media: read non-deleted, exclude sold" on public.property_media
  for select to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_media.property_id
        and ( public.has_role(auth.uid(), 'admin'::public.app_role)
              or (p.deleted_at is null and p.status <> 'Sold') )
    )
  );

drop policy if exists "Files: authenticated read non-deleted" on public.property_files;
create policy "Files: read non-deleted, exclude sold" on public.property_files
  for select to authenticated
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_files.property_id
        and ( public.has_role(auth.uid(), 'admin'::public.app_role)
              or (p.deleted_at is null and p.status <> 'Sold') )
    )
  );

-- ============================================================
-- D) appointments: agentes dejan de ver citas de propiedades vendidas
--    (citas sin propiedad o de no-vendidas siguen visibles a su dueño)
-- ============================================================
drop policy if exists "Appts: owner or admin select" on public.appointments;
create policy "Appts: owner or admin select, exclude sold" on public.appointments
  for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or (
      agent_id = auth.uid()
      and (
        property_id is null
        or exists (
          select 1 from public.properties p
          where p.id = appointments.property_id
            and p.deleted_at is null
            and p.status <> 'Sold'
        )
      )
    )
  );
