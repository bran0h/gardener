import env from '#start/env'

export interface Caller {
  id: string
  email: string
}

export const APP_ROLE = 'gardener'

const TTL_MS = 60_000

/**
 * Resolves a Supabase access token to a caller allowed to use Gardener.
 *
 * Same approach as the pdf.hozza.dev API: ask Supabase who the token belongs
 * to, then ask the database function has_role() *with the caller's own token*,
 * so the rule ("admin opens everything") lives in one place. Results are cached
 * briefly so a burst of requests costs one round trip.
 */
export class SupabaseAuthService {
  static #cache = new Map<string, { caller: Caller | null; expires: number }>()

  async authenticate(token: string): Promise<Caller | null> {
    const cache = SupabaseAuthService.#cache
    const hit = cache.get(token)
    if (hit && hit.expires > Date.now()) return hit.caller

    const caller = await this.#lookup(token).catch(() => null)
    cache.set(token, { caller, expires: Date.now() + TTL_MS })
    if (cache.size > 500) {
      const now = Date.now()
      for (const [k, v] of cache) if (v.expires <= now) cache.delete(k)
    }
    return caller
  }

  async #lookup(token: string): Promise<Caller | null> {
    const base = env.get('SUPABASE_URL').replace(/\/$/, '')
    const headers = { apikey: env.get('SUPABASE_KEY'), authorization: `Bearer ${token}` }

    const userRes = await fetch(`${base}/auth/v1/user`, { headers })
    if (!userRes.ok) return null
    const user = (await userRes.json()) as { id?: string; email?: string }
    if (!user.id) return null

    const roleRes = await fetch(`${base}/rest/v1/rpc/has_role`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ role_name: APP_ROLE }),
    })
    if (!roleRes.ok || (await roleRes.json()) !== true) return null

    return { id: user.id, email: user.email ?? '' }
  }
}
