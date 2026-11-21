-- First visit: give someone without any home a "Home", exactly once.
--
-- The app used to do "no homes? create one" from several components at the
-- same moment, which made duplicates. This does the check and the insert under
-- a per-person transaction lock, so concurrent calls wait for each other and
-- only the first one creates anything.

create or replace function public.gardener_ensure_home()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  existing uuid;
  created public.gardener_homes;
begin
  if uid is null or not public.has_role('gardener') then
    raise exception 'No access to Gardener.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('gardener_ensure_home'), hashtext(uid::text));

  select m.home_id into existing
    from public.gardener_home_members m
    join public.gardener_homes h on h.id = m.home_id
   where m.user_id = uid
   order by h.created_at
   limit 1;
  if found then
    return existing;
  end if;

  created := public.gardener_create_home('Home');
  return created.id;
end;
$$;

revoke execute on function public.gardener_ensure_home() from public, anon;
grant execute on function public.gardener_ensure_home() to authenticated;
