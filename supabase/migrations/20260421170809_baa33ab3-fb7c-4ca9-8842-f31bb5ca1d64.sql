
-- Public buckets for property media and downloadable files
insert into storage.buckets (id, name, public)
values ('property-media', 'property-media', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('property-files', 'property-files', true)
on conflict (id) do nothing;

-- Policies: public read, authenticated write/update/delete
create policy "Property media: public read"
  on storage.objects for select
  using (bucket_id = 'property-media');

create policy "Property media: authenticated insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'property-media');

create policy "Property media: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'property-media');

create policy "Property media: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'property-media');

create policy "Property files: public read"
  on storage.objects for select
  using (bucket_id = 'property-files');

create policy "Property files: authenticated insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'property-files');

create policy "Property files: authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'property-files');

create policy "Property files: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'property-files');
