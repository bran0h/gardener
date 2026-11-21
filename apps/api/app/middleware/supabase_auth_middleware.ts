import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import { SupabaseAuthService, type Caller } from '#services/supabase_auth_service'

/**
 * Errors are translation keys (errors.*); the web app shows them translated.
 *
 * Requires a Supabase access token (Authorization: Bearer …) from someone
 * holding the `gardener` role (or `admin`), and puts them on ctx.caller.
 */
export default class SupabaseAuthMiddleware {
  #auth = new SupabaseAuthService()

  async handle(ctx: HttpContext, next: NextFn) {
    const header = ctx.request.header('authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
    if (!token) return ctx.response.unauthorized({ error: 'errors.signInFirst' })

    const caller = await this.#auth.authenticate(token)
    if (!caller) return ctx.response.forbidden({ error: 'errors.noAccess' })

    ctx.caller = caller
    return next()
  }
}

declare module '@adonisjs/core/http' {
  interface HttpContext {
    caller: Caller
  }
}
