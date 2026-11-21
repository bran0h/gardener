import { BaseModel, column } from '@adonisjs/lucid/orm'
import db from '@adonisjs/lucid/services/db'

/** A home (public.gardener_homes). Owned by the Supabase migrations; read only here. */
export default class Home extends BaseModel {
  static table = 'gardener_homes'

  /** The gardener_api role may read only these columns. */
  static readonly readable = ['id', 'name']

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare name: string

  /** home ids per person, from gardener_home_members (composite key, so no model). */
  static async idsByUser(userIds: string[]): Promise<Map<string, string[]>> {
    const rows: { home_id: string; user_id: string }[] = userIds.length
      ? await db.from('gardener_home_members').select('home_id', 'user_id').whereIn('user_id', userIds)
      : []
    const map = new Map<string, string[]>()
    for (const r of rows) map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.home_id])
    return map
  }
}
