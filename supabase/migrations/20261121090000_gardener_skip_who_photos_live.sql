-- Skip today, who watered, photo timeline, live updates.

-- Skip today -----------------------------------------------------------------
-- "Soil is still wet": the plant is not due again before snoozed_until (a date
-- in the person's calendar, sent by the app). Watering clears it.

alter table public.gardener_plants add column snoozed_until date;

alter table public.gardener_care_logs drop constraint gardener_care_logs_kind_check;
alter table public.gardener_care_logs
  add constraint gardener_care_logs_kind_check
  check (kind in ('water', 'skip', 'repot', 'prune', 'mist', 'note'));

-- Who watered ------------------------------------------------------------------

alter table public.gardener_plants
  add column last_watered_by uuid references auth.users (id) on delete set null;

create or replace function public.gardener_sync_last_care()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  pid uuid := coalesce(new.plant_id, old.plant_id);
begin
  update public.gardener_plants p
     set (last_watered_at, last_watered_by) = (
           select l.done_at, l.user_id from public.gardener_care_logs l
            where l.plant_id = pid and l.kind = 'water'
            order by l.done_at desc
            limit 1)
   where p.id = pid;

  if tg_op = 'INSERT' and new.kind = 'water' then
    update public.gardener_plants set snoozed_until = null where id = new.plant_id;
  end if;

  if tg_op = 'UPDATE' and old.plant_id is distinct from new.plant_id then
    update public.gardener_plants p
       set (last_watered_at, last_watered_by) = (
             select l.done_at, l.user_id from public.gardener_care_logs l
              where l.plant_id = old.plant_id and l.kind = 'water'
              order by l.done_at desc
              limit 1)
     where p.id = old.plant_id;
  end if;
  return null;
end;
$$;

update public.gardener_plants p
   set last_watered_by = (
         select l.user_id from public.gardener_care_logs l
          where l.plant_id = p.id and l.kind = 'water'
          order by l.done_at desc
          limit 1);

-- Skipping is one call: a diary entry per plant plus the snooze, together.
-- Security invoker: the caller's own RLS decides which plants they may touch.
create or replace function public.gardener_skip_watering(plant_ids uuid[], until date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.gardener_care_logs (plant_id, kind)
  select unnest(plant_ids), 'skip';
  update public.gardener_plants set snoozed_until = until where id = any (plant_ids);
end;
$$;

revoke execute on function public.gardener_skip_watering(uuid[], date) from public, anon;
grant execute on function public.gardener_skip_watering(uuid[], date) to authenticated;

-- The reminders API reads both.
grant select (snoozed_until, last_watered_by) on public.gardener_plants to gardener_api;

-- Photo timeline -----------------------------------------------------------------
-- Every photo of a plant is kept; gardener_plants.photo_path stays the cover.

create table public.gardener_plant_photos (
  id          uuid primary key default gen_random_uuid(),
  plant_id    uuid not null references public.gardener_plants (id) on delete cascade,
  path        text not null unique check (char_length(path) <= 300),
  taken_at    timestamptz not null default now(),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index gardener_plant_photos_plant_idx on public.gardener_plant_photos (plant_id, taken_at desc);

alter table public.gardener_plant_photos enable row level security;

grant select, delete on public.gardener_plant_photos to authenticated;
grant insert (plant_id, path, taken_at) on public.gardener_plant_photos to authenticated;
grant update (taken_at) on public.gardener_plant_photos to authenticated;

create policy "gardener: photos of my plants" on public.gardener_plant_photos
  for all to authenticated
  using (exists (select 1 from public.gardener_plants p where p.id = plant_id))
  with check (
    exists (select 1 from public.gardener_plants p where p.id = plant_id)
    and created_by = (select auth.uid())
  );

-- Existing covers become the first entry of each timeline.
insert into public.gardener_plant_photos (plant_id, path, taken_at, created_by)
select id, photo_path, updated_at, user_id
  from public.gardener_plants
 where photo_path is not null
on conflict (path) do nothing;
