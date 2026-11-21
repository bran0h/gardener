/**
 * Errors are translation keys ("errors.*") all the way: the database raises
 * them, the API answers with them, the app throws them. errMsg() turns any
 * error into a sentence in the current language.
 */

type Translate = (key: string, params?: Record<string, unknown>) => string

let translate: Translate = key => key

/** Set once by plugins/i18n-errors.ts, so errMsg works outside components too. */
export function setErrorTranslator(fn: Translate) {
  translate = fn
}

const KEY = /^errors\.[A-Za-z0-9_.]+$/

/** Postgres / PostgREST codes that mean the same thing to a person. */
const BY_CODE: Record<string, string> = {
  42501: 'errors.forbidden', // permission denied, RLS violation
  23505: 'errors.duplicate',
  23503: 'errors.notFound', // points at something that is gone
  23514: 'errors.invalid',
  22001: 'errors.invalid', // too long
  P0002: 'errors.notFound',
  PGRST116: 'errors.notFound'
}

function raw(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

/** The translation key for an error, or null when it is not one we know. */
export function errorKey(e: unknown): string | null {
  const err = (e ?? {}) as {
    code?: string
    status?: number
    statusCode?: number | string
    data?: { error?: string }
    name?: string
  }

  // Our own keys: thrown in the app, raised by the database, or sent by the API.
  const message = raw(e)
  if (KEY.test(message)) return message
  if (err.data?.error && KEY.test(err.data.error)) return err.data.error

  if (err.code && BY_CODE[err.code]) return BY_CODE[err.code]!

  const status = Number(err.statusCode ?? err.status)
  if (status === 413 || /maximum allowed size/i.test(message)) return 'errors.photoTooBig'
  if (status === 401) return 'errors.signInFirst'
  if (status === 403) return 'errors.forbidden'
  if (status === 404) return 'errors.notFound'
  if (status === 422) return 'errors.invalid'
  if (status >= 500) return 'errors.server'

  // fetch() failing outright: offline, DNS, server down (Safari says "Load failed").
  if (err.name === 'TypeError' && /fetch|load failed|network/i.test(message)) return 'errors.network'
  if (/failed to fetch|load failed|networkerror/i.test(message)) return 'errors.network'

  return null
}

/** A sentence for the person, in their language. */
export function errMsg(e: unknown): string {
  const key = errorKey(e)
  return key ? translate(key) : translate('errors.unknown', { detail: raw(e) })
}
