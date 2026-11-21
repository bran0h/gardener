-- Run as supabase_admin (storage policies) after ..._090000.

-- Photos in a plant's timeline are readable and removable by its home too.
drop policy "gardener photos: read" on storage.objects;
create policy "gardener photos: read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'gardener-photos'
    and public.has_role('gardener')
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.gardener_plants p where p.photo_path = name)
      or exists (select 1 from public.gardener_plant_photos ph where ph.path = name)
    )
  );

drop policy "gardener photos: delete" on storage.objects;
create policy "gardener photos: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'gardener-photos'
    and public.has_role('gardener')
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.gardener_plants p where p.photo_path = name)
      or exists (select 1 from public.gardener_plant_photos ph where ph.path = name)
    )
  );

-- Live updates: plants and diary changes stream to everyone who may see them
-- (Realtime checks each subscriber's RLS).
alter publication supabase_realtime add table public.gardener_plants, public.gardener_care_logs;
