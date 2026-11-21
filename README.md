# gardener.hozza.dev

Keeps track of the plants and greens in the flat: what lives where, when each one
was last watered or fed, and who is thirsty today. Every plant has a diary of care
(water, feed, repot, prune, mist, notes) and an optional photo.

Nuxt 4 + Tailwind 4, Supabase for data, storage and Google sign-in, hosted on Vercel.
Hand-drawn look: Caveat / Patrick Hand fonts, wobbly borders, and SVG doodles run
through a displacement filter (`#wobble` in `app/app.vue`).

## Develop

```bash
cp .env.example .env   # fill in Supabase values
pnpm install
pnpm dev
```

`pnpm typecheck` and `pnpm build` should both pass before deploying.

## Auth and access

Same setup as pdf.hozza.dev: the app shares the **hozza-cloud** Supabase project,
signs in with Google through `@nuxtjs/supabase`, and lets in only people holding
the `gardener` role (or `admin`), managed at auth.hozza.dev.

- `app/middleware/access.global.ts` asks `public.has_role('gardener')` after sign-in
  and signs out anyone without it.
- Row level security asks `has_role` again on every query, and each person sees
  only their own plants, so the browser check only decides what is shown.

## Supabase setup

Supabase is self-hosted at `https://supabase.hozza.dev` (Docker in `/opt/supabase` on
169.58.223.190, Caddy for TLS). Our changes to the upstream bundle live in
`docker-compose.hozza.yml` and `.env` there; `sh run.sh secrets` prints the keys.

1. `SUPABASE_URL=https://supabase.hozza.dev`, `SUPABASE_KEY` = its publishable key.
2. `supabase/migrations/20261121000000_gardener.sql` is **already applied**. To apply a
   future migration, run it through the db container (Postgres is not exposed publicly):
   ```bash
   ssh root@169.58.223.190 'docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1' < file.sql
   ```
   Create tables as `postgres` (`set role postgres;`) so ownership matches the rest of `public`.
3. The `gardener` role exists; grant it at auth.hozza.dev.
4. Redirects: `https://*.hozza.dev/**` and `http://localhost:3000/**` are allowed by
   `ADDITIONAL_REDIRECT_URLS`, so `/confirm` needs no extra setup.

## Vercel

1. Import the repo. Vercel detects Nuxt and uses pnpm from the lockfile; no extra config is needed.
2. Environment variables: `SUPABASE_URL`, `SUPABASE_KEY`.
3. Domains: add `gardener.hozza.dev`, then a DNS `CNAME gardener → cname.vercel-dns.com`.

## Layout

| Path | What |
| --- | --- |
| `app/pages/index.vue` | Today (thirsty / hungry) and all plants grouped by room |
| `app/pages/plants/` | New, detail with diary, edit |
| `app/composables/usePlants.ts` | All Supabase reads and writes, cached in shared state |
| `app/utils/care.ts` | Due-date maths and labels |
| `app/components/PlantDoodle.vue` | The hand-drawn plant illustrations |
| `app/assets/css/main.css` | Theme tokens and the sketchy `card` / `btn` / `input` styles |
