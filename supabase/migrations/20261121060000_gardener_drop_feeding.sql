-- Feeding is gone from the app: watering is enough. No plant had a feeding
-- schedule and the diary had no feeding entries when this ran.
-- Apply only after the web app and API no longer use these columns.

-- The trigger now only follows watering.
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
            where l.plant_id = pid and l.kind = 'water')
   where p.id = pid;
  if tg_op = 'UPDATE' and old.plant_id is distinct from new.plant_id then
    update public.gardener_plants p
       set last_watered_at = (
             select max(l.done_at) from public.gardener_care_logs l
              where l.plant_id = old.plant_id and l.kind = 'water')
     where p.id = old.plant_id;
  end if;
  return null;
end;
$$;

alter table public.gardener_plants
  drop column fertilize_every_days,
  drop column last_fertilized_at;

alter table public.gardener_care_logs drop constraint gardener_care_logs_kind_check;
alter table public.gardener_care_logs
  add constraint gardener_care_logs_kind_check
  check (kind in ('water', 'repot', 'prune', 'mist', 'note'));
