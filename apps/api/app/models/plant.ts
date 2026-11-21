import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { DateTime } from 'luxon'

/**
 * A plant (public.gardener_plants). The table is owned by the Supabase
 * migrations; the API only reads it, with the columns the reminders need.
 */
export default class Plant extends BaseModel {
  static table = 'gardener_plants'

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
