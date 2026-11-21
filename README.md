# gardener.hozza.dev

Keeps track of the plants and greens in the flat: what lives where, when each one
was last watered or fed, and who is thirsty today. Every plant has a diary of care
(water, feed, repot, prune, mist, notes) and an optional photo. Installed on an
iPhone Home Screen, it sends a morning reminder when someone needs water or food.

| App | What | Where |
| --- | --- | --- |
| `apps/web` | Nuxt 4 + Tailwind 4, hand-drawn look | Vercel, https://gardener.hozza.dev |
| `apps/api` | AdonisJS 7: Web Push reminders | Docker next to Supabase, https://gardener-api.hozza.dev |
| `supabase/migrations` | Tables, RLS, roles | self-hosted Supabase, https://supabase.hozza.dev |

## Develop

```bash
pnpm install
cp apps/web/.env.example apps/web/.env    # Supabase URL + publishable key
cp apps/api/.env.example apps/api/.env    # see deploy/api/.env.api.example for every key
pnpm dev:web                               # http://localhost:3000
pnpm dev:api                               # http://localhost:3333 (needs the DB tunnel below)
```

The API talks to Postgres directly. Locally, open a tunnel first (5432 on the server is
Supavisor, so the user there is `gardener_api.hozza`):

```bash
ssh -N -L 54322:127.0.0.1:5432 root@169.58.223.190
```

`pnpm typecheck` and `pnpm build` should both pass before deploying.

## Auth and access

Same setup as pdf.hozza.dev: the shared Supabase project, Google sign-in through
`@nuxtjs/supabase`, and only people holding the `gardener` role (or `admin`), managed
at auth.hozza.dev.

- `apps/web/app/middleware/access.global.ts` asks `public.has_role('gardener')` after
  sign-in and signs out anyone without it.
- Row level security asks `has_role` again on every query; each person sees only their
  own plants.
- The API checks a caller's Supabase token and `has_role` the same way
  (`app/middleware/supabase_auth_middleware.ts`).

## Reminders

iOS cannot schedule notifications from a web app, so a server sends them:

1. In the app, 🔔 → *Turn on for this device*. The browser subscribes with the API's
   VAPID key and stores the subscription in `gardener_push_subscriptions` (RLS, own rows),
   together with the device's timezone and the chosen hour.
2. The API runs `ReminderService.run()` every 5 minutes (`providers/reminder_provider.ts`).
   For each device past its hour that has not been handled today, it builds the summary
   (who is thirsty / hungry, counted in the device's timezone) and sends it. Nothing due,
   no notification. Dead subscriptions (404/410) are deleted.
3. `public/sw.js` shows the notification and opens the app on tap.

On iPhone this needs iOS 16.4+ and the app added to the Home Screen (Share → Add to Home
Screen). `node ace reminders:run` runs one pass by hand.

The API connects as the `gardener_api` Postgres role: it bypasses RLS but can only read
the plant columns it needs and `profiles.roles`, and update/delete push subscriptions.

## Supabase

Self-hosted at `https://supabase.hozza.dev` (Docker in `/opt/supabase` on 169.58.223.190,
Caddy for TLS). Our changes to the upstream bundle live in `docker-compose.hozza.yml`,
`.env` and the `gardener-api.hozza.dev` block in `volumes/proxy/caddy/Caddyfile`.

Migrations in `supabase/migrations` are applied by hand through the db container
(Postgres is not exposed publicly). Create tables as `postgres` so ownership matches:

```bash
{ echo "set role postgres;"; cat file.sql; } | ssh root@169.58.223.190 \
  'docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1'
```

Redirects `https://*.hozza.dev/**` and `http://localhost:3000/**` are allowed by
`ADDITIONAL_REDIRECT_URLS`, so `/confirm` needs no setup.

## Deploy

- **Web**: Vercel project `gardener`, root directory `apps/web`, deploys on every push to `main`.
  Env: `SUPABASE_URL`, `SUPABASE_KEY` (`NUXT_PUBLIC_API_URL` defaults to the API above).
- **API**: on the server, `sh /opt/gardener/src/deploy/api/deploy.sh` pulls `main`, builds
  `gardener-api:<sha>` from `apps/api/Dockerfile` and restarts it. Its settings live in
  `/opt/gardener/.env.api` (template: `deploy/api/.env.api.example`).

## Layout (web)

| Path | What |
| --- | --- |
| `app/pages/index.vue` | Today (thirsty / hungry) and all plants grouped by room |
| `app/pages/plants/` | New, detail with diary, edit |
| `app/composables/usePlants.ts` | All Supabase reads and writes, cached in shared state |
| `app/composables/usePush.ts`, `components/ReminderBell.vue` | Turning reminders on/off per device |
| `shared/utils/care.ts` | Due-date maths and labels |
| `app/components/DatePicker.vue` | The hand-drawn date picker |
| `app/components/PlantDoodle.vue` | The hand-drawn plant illustrations |
| `app/assets/css/main.css` | Theme tokens and the sketchy `card` / `btn` / `input` styles |
