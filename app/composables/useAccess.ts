import type { Database } from '~/types/database'
/** The role that opens this app. People holding `admin` get in too: the database applies that rule. */
export const APP_ROLE = 'gardener'

export type AccessCheck = 'allowed' | 'denied' | 'error'

/**
 * Access is decided by roles managed at auth.hozza.dev: anyone can complete
 * Google sign-in, but only people holding `gardener` (or `admin`) may use the app.
 *
 * The rule lives in the database function has_role(); this only asks it. Row
 * level security asks it again for every query, so this check decides what the
 * browser shows, not what is allowed.
 */
export function useAccess() {
  const supabase = useSupabaseClient<Database>()
  const allowed = useState<boolean | null>('has-access', () => null)
  const lastError = useState<string>('access-check-error', () => '')

  async function check(): Promise<AccessCheck> {
    if (allowed.value !== null) return allowed.value ? 'allowed' : 'denied'

    // useSupabaseUser() can be populated before the client holds the session;
    // asking then runs as anon and answers "no", which looks like a denial.
    const { data: sess, error: sessErr } = await supabase.auth.getSession()
    if (sessErr || !sess.session?.user.id) {
      lastError.value = sessErr?.message ?? 'No session'
      return 'error'
    }

    const { data, error } = await supabase.rpc('has_role', { role_name: APP_ROLE })
    if (error) {
      lastError.value = error.message
      return 'error'
    }
    allowed.value = data === true
    return allowed.value ? 'allowed' : 'denied'
  }

  function reset() {
    allowed.value = null
  }

  return { allowed, lastError, check, reset }
}
