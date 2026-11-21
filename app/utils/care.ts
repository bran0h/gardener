const DAY = 86_400_000

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/**
 * Whole days until the next care is due: negative when late, 0 for today,
 * null when the plant has no schedule. Never done counts as due today.
 */
export function daysUntilDue(last: string | null, everyDays: number | null, now = new Date()): number | null {
  if (!everyDays) return null
  if (!last) return 0
  const due = startOfDay(new Date(last)).getTime() + everyDays * DAY
  return Math.round((due - startOfDay(now).getTime()) / DAY)
}

export type DueState = 'none' | 'late' | 'today' | 'soon' | 'ok'

export function dueState(days: number | null): DueState {
  if (days === null) return 'none'
  if (days < 0) return 'late'
  if (days === 0) return 'today'
  if (days <= 2) return 'soon'
  return 'ok'
}

export function dueLabel(days: number | null): string {
  if (days === null) return 'no schedule'
  if (days < -1) return `${-days} days late`
  if (days === -1) return 'a day late'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

export function relativeDay(iso: string | null, now = new Date()): string {
  if (!iso) return 'never'
  const diff = Math.round((startOfDay(now).getTime() - startOfDay(new Date(iso)).getTime()) / DAY)
  if (diff <= 0) return 'today'
  if (diff === 1) return 'yesterday'
  if (diff < 14) return `${diff} days ago`
  if (diff < 60) return `${Math.round(diff / 7)} weeks ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

/** Today as yyyy-mm-dd in local time, for <input type="date">. */
export function todayInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** A date input value as a timestamp: now for today, midday for other days. */
export function inputToIso(value: string): string {
  if (!value || value === todayInput()) return new Date().toISOString()
  return new Date(`${value}T12:00:00`).toISOString()
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

/** A small, stable tilt per id so cards look pinned by hand. */
export function tilt(id: string, max = 1.2): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const deg = ((Math.abs(h) % 1000) / 1000) * max * 2 - max
  return `rotate(${deg.toFixed(2)}deg)`
}
