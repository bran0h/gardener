-- Errors raised by Gardener's database functions are translation keys
-- (errors.*), which the app shows in the person's language. Same functions as
-- before; only the messages changed.

create or replace function public.gardener_members_keep_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and exists (select 1 from public.gardener_homes h where h.id = old.home_id)
     and exists (select 1 from auth.users u where u.id = old.user_id)
     and not exists (
       select 1 from public.gardener_home_members m
        where m.home_id = old.home_id and m.role = 'owner' and m.user_id <> old.user_id
     )
  then
    raise exception 'errors.homeNeedsOwner'
      using errcode = '23000';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.gardener_create_home(home_name text)
returns public.gardener_homes
language plpgsql
security definer
set search_path = ''
as $$
declare
  h public.gardener_homes;
begin
  if (select auth.uid()) is null or not public.has_role('gardener') then
    raise exception 'errors.noAccess' using errcode = '42501';
  end if;
  insert into public.gardener_homes (name, created_by)
  values (btrim(home_name), (select auth.uid()))
  returning * into h;
  insert into public.gardener_home_members (home_id, user_id, role)
  values (h.id, (select auth.uid()), 'owner');
  return h;
end;
$$;

create or replace function public.gardener_accept_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv public.gardener_home_invites;
begin
  if uid is null then
    raise exception 'errors.signInFirst' using errcode = '42501';
  end if;

  select * into inv from public.gardener_home_invites
   where token = invite_token and expires_at > now();
  if not found then
    raise exception 'errors.inviteExpired' using errcode = 'P0002';
  end if;

  insert into public.gardener_home_members (home_id, user_id, role)
  values (inv.home_id, uid, 'member')
  on conflict do nothing;

  update public.profiles
     set roles = array_append(coalesce(roles, '{}'), 'gardener')
   where id = uid
     and not (coalesce(roles, '{}') && array['gardener', 'admin']);

  return inv.home_id;
end;
$$;

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
    raise exception 'errors.noAccess' using errcode = '42501';
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
