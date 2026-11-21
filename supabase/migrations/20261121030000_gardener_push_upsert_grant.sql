-- The app saves its device with an upsert (insert … on conflict (endpoint) do update),
-- and PostgREST's update part sets every column it was sent, endpoint included.
-- Row level security still limits this to the caller's own rows.
grant update (endpoint) on public.gardener_push_subscriptions to authenticated;
