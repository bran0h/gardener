import { BaseModel, column } from '@adonisjs/lucid/orm'
import type { DateTime } from 'luxon'

/**
 * One device that asked for reminders (public.gardener_push_subscriptions).
 * The browser creates and edits these rows itself through Supabase (RLS);
 * the API reads them, marks when it last reminded, and deletes dead ones.
 */
export default class PushSubscription extends BaseModel {
  static table = 'gardener_push_subscriptions'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare endpoint: string

  @column()
  declare p256dh: string

  @column()
  declare auth: string

  /** Local hour (0–23) after which the morning summary may go out. */
  @column()
  declare remindHour: number

  /** IANA timezone of the device, e.g. Europe/Bratislava. */
  @column()
  declare timezone: string

  /** The local date the summary was last handled for (sent or nothing due). */
  @column.date()
  declare lastRemindedOn: DateTime | null

  @column.dateTime()
  declare lastSentAt: DateTime | null
}
