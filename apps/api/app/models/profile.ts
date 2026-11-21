import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * public.profiles, shared with hozza-cloud and auth.hozza.dev. Only the roles
 * are read here, so the reminder job skips people who lost access.
 */
export default class Profile extends BaseModel {
  static table = 'profiles'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare roles: string[] | null

  /** Mirrors public.has_role(): admin opens every app. */
  hasRole(role: string): boolean {
    return !!this.roles?.some((r) => r === role || r === 'admin')
  }
}
