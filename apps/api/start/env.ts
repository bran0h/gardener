/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Comma-separated origins allowed to call the API from a browser
  CORS_ORIGIN: Env.schema.string.optional(),

  // Database: the self-hosted Supabase Postgres (host `db` on the Docker network),
  // as the gardener_api role created by the Supabase migration.
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.secret(),
  DB_DATABASE: Env.schema.string(),

  // Supabase API, used to check who a caller's access token belongs to
  // (on the server: the internal gateway, http://api-gw:8000)
  SUPABASE_URL: Env.schema.string({ format: 'url', tld: false }),
  SUPABASE_KEY: Env.schema.string(),

  // Web Push (VAPID). Generate with: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: Env.schema.string(),
  VAPID_PRIVATE_KEY: Env.schema.secret(),
  VAPID_SUBJECT: Env.schema.string(),

  // The reminder job. Off unless enabled, so a local API never sends
  // real notifications by accident.
  REMINDERS_ENABLED: Env.schema.boolean.optional(),
  REMINDERS_CRON: Env.schema.string.optional(),
})
