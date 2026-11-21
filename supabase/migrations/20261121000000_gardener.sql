-- Gardener: plants and their care history.
-- Lives in the shared hozza-cloud project, so every object is prefixed `gardener_`.
-- Access needs the `gardener` role (or `admin`), checked by public.has_role(),
-- which already exists in that project (roles are managed at auth.hozza.dev).

create table public.gardener_plants (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                  text not null check (char_length(name) between 1 and 80),
  species               text check (char_length(species) <= 120),
  kind                  text not null default 'leafy'
                        check (kind in ('leafy', 'succulent', 'cactus', 'flower', 'herb', 'hanging', 'tree')),
  location              text check (char_length(location) <= 60),
  light                 text check (light in ('low', 'medium', 'bright')),
  water_every_days      integer check (water_every_days between 1 and 365),
  fertilize_every_days  integer check (fertilize_every_days between 1 and 730),
  -- Kept in sync from gardener_care_logs by a trigger; do not write directly.
  last_watered_at       timestamptz,
  last_fertilized_at    timestamptz,
  photo_path            text,
  notes                 text check (char_length(notes) <= 4000),
  acquired_on           date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index gardener_plants_user_id_idx on public.gardener_plants (user_id);

create table public.gardener_care_logs (
  id          uuid primary key default gen_random_uuid(),
  plant_id    uuid not null references public.gardener_plants (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('water', 'fertilize', 'repot', 'prune', 'mist', 'note')),
  note        text check (char_length(note) <= 1000),
  done_at     timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index gardener_care_logs_plant_idx on public.gardener_care_logs (plant_id, done_at desc);
create index gardener_care_logs_user_id_idx on public.gardener_care_logs (user_id);

-- updated_at ---------------------------------------------------------------

create or replace function public.gardener_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger gardener_plants_touch
  before update on public.gardener_plants
  for each row execute function public.gardener_touch_updated_at();

-- last_watered_at / last_fertilized_at follow the log ----------------------
-- Recomputed from the log on every change, so deleting a mistaken entry
-- puts the date back where it was.

create or replace function public.gardener_sync_last_care()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  pid uuid := coalesce(new.plant_id, old.plant_id);
begin
  update public.gardener_plants p
     set last_watered_at = (
           select max(l.done_at) from public.gardener_care_logs l
            where l.plant_id = pid and l.kind = 'water'),
         last_fertilized_at = (
           select max(l.done_at) from public.gardener_care_logs l
            where l.plant_id = pid and l.kind = 'fertilize')
   where p.id = pid;
  if tg_op = 'UPDATE' and old.plant_id is distinct from new.plant_id then
    update public.gardener_plants p
       set last_watered_at = (
             select max(l.done_at) from public.gardener_care_logs l
              where l.plant_id = old.plant_id and l.kind = 'water'),
           last_fertilized_at = (
             select max(l.done_at) from public.gardener_care_logs l
              where l.plant_id = old.plant_id and l.kind = 'fertilize')
     where p.id = old.plant_id;
  end if;
  return null;
end;
$$;

create trigger gardener_care_logs_sync
  after insert or update or delete on public.gardener_care_logs
  for each row execute function public.gardener_sync_last_care();

-- Row level security -------------------------------------------------------

alter table public.gardener_plants enable row level security;
alter table public.gardener_care_logs enable row level security;

grant select, insert, update, delete on public.gardener_plants to authenticated;
grant select, insert, update, delete on public.gardener_care_logs to authenticated;

create policy "gardener: own plants"
  on public.gardener_plants
  for all
  to authenticated
  using (user_id = (select auth.uid()) and public.has_role('gardener'))
  with check (user_id = (select auth.uid()) and public.has_role('gardener'));

create policy "gardener: own care logs"
  on public.gardener_care_logs
  for all
  to authenticated
  using (user_id = (select auth.uid()) and public.has_role('gardener'))
  with check (
    user_id = (select auth.uid())
    and public.has_role('gardener')
    and exists (
      select 1 from public.gardener_plants p
       where p.id = plant_id and p.user_id = (select auth.uid())
    )
  );

-- Photos -------------------------------------------------------------------
-- Private bucket; each user writes only under a folder named by their id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gardener-photos', 'gardener-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "gardener: own photos"
  on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'gardener-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_role('gardener')
  )
  with check (
    bucket_id = 'gardener-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.has_role('gardener')
  );
