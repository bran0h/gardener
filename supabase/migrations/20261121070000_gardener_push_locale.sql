-- Reminders arrive in the language the device uses in the app (en / sk).
alter table public.gardener_push_subscriptions
  add column locale text not null default 'en' check (locale in ('en', 'sk'));

grant insert (locale), update (locale) on public.gardener_push_subscriptions to authenticated;
-- gardener_api already has select on the whole table.
