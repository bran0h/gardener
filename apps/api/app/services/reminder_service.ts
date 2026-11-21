import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import Home from '#models/home'
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

export type Locale = 'en' | 'sk'

/** Slovak plural: 1 / 2–4 / 0 and 5+. */
function sk(n: number, one: string, few: string, many: string) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many
}

const TEXT = {
  en: {
    and: 'and',
    more: (n: number) => `and ${n} more`,
    oneThirsty: (name: string) => `💧 ${name} is thirsty`,
    manyThirsty: (n: number) => `💧 ${n} plants are thirsty`,
    water: (what: string) => `Water ${what}.`,
    waterGrouped: (what: string) => `Water ${what}.`,
    tapToMark: 'Tap to mark it done.',
    home: 'Home',
    testTitle: '🌱 Reminders work!',
    testBody: 'Nobody needs water right now. You will hear from me when someone gets thirsty.',
  },
  sk: {
    and: 'a',
    more: (n: number) => `a ${sk(n, 'ďalšia', 'ďalšie', 'ďalších')} ${n}`,
    oneThirsty: (name: string) => `💧 ${name} potrebuje vodu`,
    manyThirsty: (n: number) => `💧 ${n} ${sk(n, 'rastlina potrebuje', 'rastliny potrebujú', 'rastlín potrebuje')} vodu`,
    // Names stay in the nominative: user-chosen names cannot be declined.
    water: (what: string) => `Treba poliať: ${what}.`,
    waterGrouped: (what: string) => `Treba poliať – ${what}.`,
    tapToMark: 'Ťukni a odškrtni polievanie.',
    home: 'Domov',
    testTitle: '🌱 Pripomienky fungujú!',
    testBody: 'Teraz nikto nepotrebuje vodu. Ozvem sa, keď bude niekto smädný.',
  },
} satisfies Record<Locale, unknown>

export function texts(locale: string | null | undefined) {
  return TEXT[locale === 'sk' ? 'sk' : 'en']
}

function names(list: Plant[], locale: Locale, max = 3): string {
  const t = texts(locale)
  const shown = list.slice(0, max).map((p) => p.name)
  const rest = list.length - shown.length
  if (rest > 0) return `${shown.join(', ')} ${t.more(rest)}`
  if (shown.length > 1) return `${shown.slice(0, -1).join(', ')} ${t.and} ${shown.at(-1)}`
  return shown[0] ?? ''
}

/**
 * The morning summary for one person across their homes, or null when nobody
 * is thirsty. With several homes involved, the body names them.
 */
export function buildDigest(
  plants: Plant[],
  today: string,
  timeZone: string,
  homeNames: Map<string, string> = new Map(),
  locale: Locale = 'en'
): PushPayload | null {
  const t = texts(locale)
  const thirsty = plants.filter((p) => {
    const d = daysUntilDue(p.lastWateredAt, p.waterEveryDays, today, timeZone)
    return d !== null && d <= 0
  })
  if (!thirsty.length) return null

  const title = thirsty.length === 1 ? t.oneThirsty(thirsty[0]!.name) : t.manyThirsty(thirsty.length)

  const homesInvolved = new Set(thirsty.map((p) => p.homeId))
  let body: string
  if (homesInvolved.size > 1) {
    const groups = new Map<string, Plant[]>()
    for (const p of thirsty) groups.set(p.homeId, [...(groups.get(p.homeId) ?? []), p])
    body = t.waterGrouped(
      [...groups.entries()]
        .map(([id, ps]) => `${homeNames.get(id) ?? t.home}: ${names(ps, locale, 2)}`)
        .join(' · ')
    )
  } else if (thirsty.length > 1) {
    body = t.water(names(thirsty, locale))
  } else {
    body = t.tapToMark
  }

  return { title, body, url: '/', tag: `gardener-${today}` }
}

/** Plants and home names for a set of people, via their home memberships. */
async function plantsForPeople(userIds: string[]) {
  const homeIdsByUser = await Home.idsByUser(userIds)
  const homeIds = [...new Set([...homeIdsByUser.values()].flat())]
  const [homes, plants] = homeIds.length
    ? await Promise.all([
        Home.query().select(Home.readable).whereIn('id', homeIds),
        Plant.query().select(Plant.readable).whereIn('home_id', homeIds),
      ])
    : [[], []]
  const homeNames = new Map(homes.map((h) => [h.id, h.name]))
  const plantsOf = (userId: string) => {
    const mine = new Set(homeIdsByUser.get(userId) ?? [])
    return plants.filter((p) => mine.has(p.homeId))
  }
  return { homeNames, plantsOf }
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
    const { homeNames, plantsOf } = await plantsForPeople([...allowed])

    for (const sub of subs) {
      stats.checked++
      const tz = safeZone(sub.timezone)
      const today = localDate(now, tz)

      const payload = allowed.has(sub.userId)
        ? buildDigest(plantsOf(sub.userId), today, tz, homeNames, sub.locale)
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

    const { homeNames, plantsOf } = await plantsForPeople([userId])
    const plants = plantsOf(userId)
    let sent = 0
    for (const sub of subs) {
      const tz = safeZone(sub.timezone)
      const t = texts(sub.locale)
      const payload = buildDigest(plants, localDate(new Date(), tz), tz, homeNames, sub.locale) ?? {
        title: t.testTitle,
        body: t.testBody,
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
