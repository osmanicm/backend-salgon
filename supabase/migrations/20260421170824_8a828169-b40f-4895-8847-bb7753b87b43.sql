
drop policy if exists "Property media: public read" on storage.objects;
drop policy if exists "Property files: public read" on storage.objects;

create policy "Property media: authenticated read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'property-media');

create policy "Property files: authenticated read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'property-files');
