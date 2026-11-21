import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import Plant from '#models/plant'
import Profile from '#models/profile'
import PushSubscription from '#models/push_subscription'
import { APP_ROLE } from '#services/supabase_auth_service'
import { PushSenderService, type PushPayload } from '#services/push_sender_service'

const DAY = 86_400_000
const FALLBACK_TZ = 'Europe/Bratislava'

export interface RunStats {
  checked: number
  sent: number
  nothingDue: number
  removed: number
  failed: number
}

/** yyyy-mm-dd of an instant, as seen in a timezone. */
export function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/** The hour (0–23) of an instant, as seen in a timezone. */
export function localHour(instant: Date, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(
      instant
    )
  )
}

function safeZone(tz: string | null | undefined): string {
  if (!tz) return FALLBACK_TZ
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz })
    return tz
  } catch {
    return FALLBACK_TZ
  }
}

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!) / DAY
}

/**
 * Whole days until care is due, in calendar days of the person's timezone:
 * negative when late, 0 for today, null without a schedule. Same rule as the
 * web app: never done counts as due today.
 */
export function daysUntilDue(
  last: DateTime | null,
  everyDays: number | null,
  today: string,
  timeZone: string
): number | null {
  if (!everyDays) return null
  if (!last) return 0
  return dayNumber(localDate(last.toJSDate(), timeZone)) + everyDays - dayNumber(today)
}

function names(list: Plant[], max = 3): string {
  const shown = list.slice(0, max).map((p) => p.name)
  const rest = list.length - shown.length
  if (rest > 0) return `${shown.join(', ')} and ${rest} more`
  if (shown.length > 1) return `${shown.slice(0, -1).join(', ')} and ${shown.at(-1)}`
  return shown[0] ?? ''
}

/** The morning summary for one person, or null when nobody needs anything. */
export function buildDigest(plants: Plant[], today: string, timeZone: string): PushPayload | null {
  const due = (p: Plant, kind: 'water' | 'feed') => {
    const d =
      kind === 'water'
        ? daysUntilDue(p.lastWateredAt, p.waterEveryDays, today, timeZone)
        : daysUntilDue(p.lastFertilizedAt, p.fertilizeEveryDays, today, timeZone)
    return d !== null && d <= 0
  }
  const thirsty = plants.filter((p) => due(p, 'water'))
  const hungry = plants.filter((p) => due(p, 'feed'))
  if (!thirsty.length && !hungry.length) return null

  let title: string
  if (thirsty.length === 1) title = `💧 ${thirsty[0]!.name} is thirsty`
  else if (thirsty.length > 1) title = `💧 ${thirsty.length} plants are thirsty`
  else if (hungry.length === 1) title = `🌱 ${hungry[0]!.name} could use some food`
  else title = `🌱 ${hungry.length} plants are hungry`

  const lines: string[] = []
  if (thirsty.length > 1) lines.push(`Water ${names(thirsty)}.`)
  if (hungry.length && (thirsty.length || hungry.length > 1)) lines.push(`Feed ${names(hungry)}.`)
  if (!lines.length) lines.push('Tap to mark it done.')

  return { title, body: lines.join(' '), url: '/', tag: `gardener-${today}` }
}

/**
 * Sends each device its morning summary once a day, after the hour its owner
 * picked, in the device's own timezone. Safe to run as often as you like.
 */
@inject()
export class ReminderService {
  constructor(protected sender: PushSenderService) {}

  async run(now = new Date()): Promise<RunStats> {
    const stats: RunStats = { checked: 0, sent: 0, nothingDue: 0, removed: 0, failed: 0 }

    const subs = (await PushSubscription.all()).filter((s) => {
      const tz = safeZone(s.timezone)
      return localHour(now, tz) >= s.remindHour && s.lastRemindedOn?.toISODate() !== localDate(now, tz)
    })
    if (!subs.length) return stats

    const userIds = [...new Set(subs.map((s) => s.userId))]
    const profiles = await Profile.query().select(Profile.readable).whereIn('id', userIds)
    const allowed = new Set(profiles.filter((p) => p.hasRole(APP_ROLE)).map((p) => p.id))
    const plants = allowed.size ? await Plant.query().select(Plant.readable).whereIn('user_id', [...allowed]) : []

    for (const sub of subs) {
      stats.checked++
      const tz = safeZone(sub.timezone)
      const today = localDate(now, tz)

      const payload = allowed.has(sub.userId)
        ? buildDigest(
            plants.filter((p) => p.userId === sub.userId),
            today,
            tz
          )
        : null

      if (payload) {
        const result = await this.sender.send(sub, payload)
        if (result === 'gone') {
          await sub.delete()
          stats.removed++
          continue
        }
        // A failed send is retried on the next run instead of being marked done.
        if (result === 'error') {
          stats.failed++
          continue
        }
        sub.lastSentAt = DateTime.fromJSDate(now)
        stats.sent++
      } else {
        stats.nothingDue++
      }

      sub.lastRemindedOn = DateTime.fromISO(today)
      await sub.save()
    }

    if (stats.sent || stats.removed || stats.failed) logger.info(stats, 'reminders sent')
    return stats
  }

  /**
   * "Send me a test" from the app: today's summary if something is due,
   * otherwise a friendly hello, to one device or all of the person's devices.
   */
  async sendNow(userId: string, endpoint?: string) {
    const query = PushSubscription.query().where('user_id', userId)
    if (endpoint) query.where('endpoint', endpoint)
    const subs = await query

    const plants = await Plant.query().select(Plant.readable).where('user_id', userId)
    let sent = 0
    for (const sub of subs) {
      const tz = safeZone(sub.timezone)
      const payload = buildDigest(plants, localDate(new Date(), tz), tz) ?? {
        title: '🌱 Reminders work!',
        body: 'Nobody needs anything right now. You will hear from me when someone gets thirsty.',
        url: '/',
        tag: 'gardener-test',
      }
      const result = await this.sender.send(sub, payload)
      if (result === 'gone') await sub.delete()
      if (result === 'ok') sent++
    }
    return { devices: subs.length, sent }
  }
}
