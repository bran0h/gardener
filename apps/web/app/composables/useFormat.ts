/** Dates and care labels in the current language. */
export function useFormat() {
  const { t, locale, locales } = useI18n()

  /** BCP 47 tag of the current language, e.g. sk-SK, for Intl formatting. */
  const tag = computed(() =>
    (locales.value as { code: string, language?: string }[]).find(l => l.code === locale.value)?.language ?? 'en-GB'
  )

  function date(value: Date | string, options: Intl.DateTimeFormatOptions) {
    return new Date(value).toLocaleDateString(tag.value, options)
  }

  function time(value: Date, options: Intl.DateTimeFormatOptions) {
    return value.toLocaleTimeString(tag.value, options)
  }

  /** "2 days late", "today", "tomorrow", "in 4 days", "no schedule". */
  function dueLabel(days: number | null): string {
    if (days === null) return t('due.noSchedule')
    if (days < 0) return t('due.late', { n: -days }, -days)
    if (days === 0) return t('due.today')
    if (days === 1) return t('due.tomorrow')
    return t('due.inDays', { n: days }, days)
  }

  /** "today", "yesterday", "5 days ago", "3 weeks ago" or a date. */
  function relativeDay(iso: string | null): string {
    if (!iso) return t('relative.never')
    const diff = daysSince(iso)
    if (diff <= 0) return t('relative.today')
    if (diff === 1) return t('relative.yesterday')
    if (diff < 14) return t('relative.daysAgo', { n: diff }, diff)
    if (diff < 60) {
      const w = Math.round(diff / 7)
      return t('relative.weeksAgo', { n: w }, w)
    }
    return date(iso, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  /** "Sat 21 Nov" */
  function formatDay(iso: string): string {
    return date(iso, { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return { tag, date, time, dueLabel, relativeDay, formatDay }
}
