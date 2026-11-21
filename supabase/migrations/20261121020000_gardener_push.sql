-- Gardener reminders: devices that asked for push notifications, and the
-- database role the Adonis API (apps/api) connects as.

create table public.gardener_push_subscriptions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint          text not null unique check (char_length(endpoint) <= 1000),
  p256dh            text not null check (char_length(p256dh) <= 200),
  auth              text not null check (char_length(auth) <= 100),
  -- Local hour (0–23) after which the morning summary may go out.
  remind_hour       smallint not null default 8 check (remind_hour between 0 and 23),
  timezone          text not null default 'Europe/Bratislava' check (char_length(timezone) <= 64),
  user_agent        text check (char_length(user_agent) <= 300),
  -- Written by the API only.
  last_reminded_on  date,
  last_sent_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index gardener_push_subscriptions_user_id_idx on public.gardener_push_subscriptions (user_id);

alter table public.gardener_push_subscriptions enable row level security;

grant select, delete on public.gardener_push_subscriptions to authenticated;
grant insert (endpoint, p256dh, auth, remind_hour, timezone, user_agent)
  on public.gardener_push_subscriptions to authenticated;
grant update (p256dh, auth, remind_hour, timezone, user_agent)
  on public.gardener_push_subscriptions to authenticated;

create policy "gardener: own push subscriptions"
  on public.gardener_push_subscriptions
  for all
  to authenticated
  using (user_id = (select auth.uid()) and public.has_role('gardener'))
  with check (user_id = (select auth.uid()) and public.has_role('gardener'));

-- The API role -------------------------------------------------------------
-- Reads every subscriber's plants for the reminder job, so it bypasses RLS,
-- but it can only touch what the job needs. The password is set outside the
-- migrations:  alter role gardener_api with login password '…';

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'gardener_api') then
    create role gardener_api nologin bypassrls;
  end if;
end
$$;

grant usage on schema public to gardener_api;
grant select (id, user_id, name, water_every_days, fertilize_every_days, last_watered_at, last_fertilized_at)
  on public.gardener_plants to gardener_api;
grant select (id, roles) on public.profiles to gardener_api;
grant select, delete on public.gardener_push_subscriptions to gardener_api;
grant update (last_reminded_on, last_sent_at) on public.gardener_push_subscriptions to gardener_api;
