import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { DateTime } from 'luxon'

/**
 * A plant (public.gardener_plants). The table is owned by the Supabase
 * migrations; the API only reads it, with the columns the reminders need.
 */
export default class Plant extends BaseModel {
  static table = 'gardener_plants'

  /**
   * The gardener_api role may read only these columns, so queries must select
   * them explicitly (a plain `select *` is refused).
   */
  static readonly readable = [
    'id',
    'user_id',
    'name',
    'water_every_days',
    'fertilize_every_days',
    'last_watered_at',
    'last_fertilized_at',
  ]

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare name: string

  @column()
  declare waterEveryDays: number | null

  @column()
  declare fertilizeEveryDays: number | null

  @column.dateTime()
  declare lastWateredAt: DateTime | null

  @column.dateTime()
  declare lastFertilizedAt: DateTime | null
}
