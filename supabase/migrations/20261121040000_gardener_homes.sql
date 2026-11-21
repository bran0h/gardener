-- Gardener homes: plants belong to a home, people join homes by invite link.
--
--   * Anyone with access can create a home and becomes its owner.
--   * Owners rename/delete the home, invite (7-day links), remove people and
--     make others owners. Members add, edit, water and delete plants.
--   * Accepting an invite also grants the `gardener` role (auth.hozza.dev), so
--     invited people get in without an admin, and can be revoked there.
--   * Every rule goes through gardener_is_member(), which also requires
--     has_role('gardener'): revoking the role at auth.hozza.dev locks someone out.

-- Tables -------------------------------------------------------------------

create table public.gardener_homes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger gardener_homes_touch
  before update on public.gardener_homes
  for each row execute function public.gardener_touch_updated_at();

create table public.gardener_home_members (
  home_id    uuid not null references public.gardener_homes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (home_id, user_id)
);

create index gardener_home_members_user_id_idx on public.gardener_home_members (user_id);

create table public.gardener_home_invites (
  id          uuid primary key default gen_random_uuid(),
  home_id     uuid not null references public.gardener_homes (id) on delete cascade,
  -- 18 random bytes, URL-safe: the link itself is the secret.
  token       text not null unique
              default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  expires_at  timestamptz not null default now() + interval '7 days',
  created_at  timestamptz not null default now()
);

create index gardener_home_invites_home_id_idx on public.gardener_home_invites (home_id);

-- Access helpers -----------------------------------------------------------

create or replace function public.gardener_is_member(home uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('gardener')
     and exists (
       select 1 from public.gardener_home_members m
        where m.home_id = home and m.user_id = (select auth.uid())
     )
$$;

create or replace function public.gardener_is_owner(home uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('gardener')
     and exists (
       select 1 from public.gardener_home_members m
        where m.home_id = home and m.user_id = (select auth.uid()) and m.role = 'owner'
     )
$$;

-- A home always keeps an owner (unless the home itself, or the person's
-- account, is being deleted).
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
    raise exception 'A home needs an owner. Make someone else an owner first, or delete the home.'
      using errcode = '23000';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger gardener_members_keep_owner
  before update or delete on public.gardener_home_members
  for each row execute function public.gardener_members_keep_owner();

-- RPCs ---------------------------------------------------------------------

-- Creates a home owned by the caller. (An RPC rather than a plain insert:
-- the caller can only see the new row once they are its member.)
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
    raise exception 'No access to Gardener.' using errcode = '42501';
  end if;
  insert into public.gardener_homes (name, created_by)
  values (btrim(home_name), (select auth.uid()))
  returning * into h;
  insert into public.gardener_home_members (home_id, user_id, role)
  values (h.id, (select auth.uid()), 'owner');
  return h;
end;
$$;

-- People in a home, with name and avatar (profiles are otherwise private).
create or replace function public.gardener_home_people(home uuid)
returns table (user_id uuid, role text, joined_at timestamptz, full_name text, avatar_url text, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, m.role, m.joined_at, p.full_name, p.avatar_url, p.email::text
    from public.gardener_home_members m
    left join public.profiles p on p.id = m.user_id
   where m.home_id = home
     and public.gardener_is_member(home)
   order by (m.role = 'owner') desc, m.joined_at
$$;

-- What an invite link is for, shown before joining. Works without the role.
create or replace function public.gardener_invite_preview(invite_token text)
returns table (home_id uuid, home_name text, invited_by text, expires_at timestamptz, already_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id,
         h.name,
         coalesce(nullif(p.full_name, ''), split_part(p.email::text, '@', 1)),
         i.expires_at,
         exists (
           select 1 from public.gardener_home_members m
            where m.home_id = h.id and m.user_id = (select auth.uid())
         )
    from public.gardener_home_invites i
    join public.gardener_homes h on h.id = i.home_id
    left join public.profiles p on p.id = i.created_by
   where i.token = invite_token
     and i.expires_at > now()
$$;

-- Joins the home behind an invite link and grants the `gardener` role.
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
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select * into inv from public.gardener_home_invites
   where token = invite_token and expires_at > now();
  if not found then
    raise exception 'This invite link has expired or was revoked.' using errcode = 'P0002';
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

revoke execute on function
  public.gardener_is_member(uuid),
  public.gardener_is_owner(uuid),
  public.gardener_create_home(text),
  public.gardener_home_people(uuid),
  public.gardener_invite_preview(text),
  public.gardener_accept_invite(text)
from public, anon;

grant execute on function
  public.gardener_is_member(uuid),
  public.gardener_is_owner(uuid),
  public.gardener_create_home(text),
  public.gardener_home_people(uuid),
  public.gardener_invite_preview(text),
  public.gardener_accept_invite(text)
to authenticated;

revoke execute on function public.gardener_members_keep_owner() from public, anon, authenticated;

-- Row level security -------------------------------------------------------

alter table public.gardener_homes enable row level security;
alter table public.gardener_home_members enable row level security;
alter table public.gardener_home_invites enable row level security;

grant select, delete on public.gardener_homes to authenticated;
grant update (name) on public.gardener_homes to authenticated;
grant select, delete on public.gardener_home_members to authenticated;
grant update (role) on public.gardener_home_members to authenticated;
grant select, delete on public.gardener_home_invites to authenticated;
grant insert (home_id) on public.gardener_home_invites to authenticated;

create policy "gardener: homes I belong to" on public.gardener_homes
  for select to authenticated using (public.gardener_is_member(id));
create policy "gardener: owners rename homes" on public.gardener_homes
  for update to authenticated using (public.gardener_is_owner(id)) with check (public.gardener_is_owner(id));
create policy "gardener: owners delete homes" on public.gardener_homes
  for delete to authenticated using (public.gardener_is_owner(id));

create policy "gardener: members see members" on public.gardener_home_members
  for select to authenticated using (public.gardener_is_member(home_id));
create policy "gardener: owners remove, anyone leaves" on public.gardener_home_members
  for delete to authenticated
  using (public.gardener_is_owner(home_id) or user_id = (select auth.uid()));
create policy "gardener: owners change roles" on public.gardener_home_members
  for update to authenticated
  using (public.gardener_is_owner(home_id)) with check (public.gardener_is_owner(home_id));

create policy "gardener: owners manage invites" on public.gardener_home_invites
  for all to authenticated
  using (public.gardener_is_owner(home_id))
  with check (public.gardener_is_owner(home_id) and created_by = (select auth.uid()));

-- Plants move into homes ---------------------------------------------------

alter table public.gardener_plants
  add column home_id uuid references public.gardener_homes (id) on delete cascade;

-- One "Home" per person who already has plants, owned by them.
do $$
declare
  u uuid;
  h uuid;
begin
  for u in select distinct user_id from public.gardener_plants where home_id is null loop
    insert into public.gardener_homes (name, created_by) values ('Home', u) returning id into h;
    insert into public.gardener_home_members (home_id, user_id, role) values (h, u, 'owner');
    update public.gardener_plants set home_id = h where user_id = u and home_id is null;
  end loop;
end
$$;

alter table public.gardener_plants alter column home_id set not null;
create index gardener_plants_home_id_idx on public.gardener_plants (home_id);

comment on column public.gardener_plants.user_id is 'Who added the plant. Access is by home_id.';

drop policy "gardener: own plants" on public.gardener_plants;
create policy "gardener: plants of my homes" on public.gardener_plants
  for all to authenticated
  using (public.gardener_is_member(home_id))
  with check (public.gardener_is_member(home_id));

-- Care log: anyone in the plant's home sees and removes entries; each entry
-- records who did it.
drop policy "gardener: own care logs" on public.gardener_care_logs;
create policy "gardener: care logs of my homes" on public.gardener_care_logs
  for all to authenticated
  using (exists (select 1 from public.gardener_plants p where p.id = plant_id))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.gardener_plants p where p.id = plant_id)
  );

-- Photos: still uploaded into the uploader's own folder, readable by everyone
-- who can see a plant using them.
drop policy "gardener: own photos" on storage.objects;
create policy "gardener photos: read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'gardener-photos'
    and public.has_role('gardener')
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.gardener_plants p where p.photo_path = name)
    )
  );
create policy "gardener photos: upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gardener-photos'
    and public.has_role('gardener')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "gardener photos: delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'gardener-photos'
    and public.has_role('gardener')
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.gardener_plants p where p.photo_path = name)
    )
  );

-- The reminders API reads homes too.
grant select (home_id) on public.gardener_plants to gardener_api;
grant select (id, name) on public.gardener_homes to gardener_api;
grant select (home_id, user_id) on public.gardener_home_members to gardener_api;
