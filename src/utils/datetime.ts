export const EVENT_TIMEZONE = 'America/Chicago'

function parseInstant(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

const chicagoDatePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
})

const CHICAGO_WEEKDAY_OFFSET: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
}

/** Monday date key `YYYY-MM-DD` for the America/Chicago week containing `instant`. */
export function chicagoWeekMondayKey(instant: Date | string = new Date()) {
  const date = typeof instant === 'string' ? parseInstant(instant) : instant
  if (!date || Number.isNaN(date.getTime())) return null

  const parts = Object.fromEntries(
    chicagoDatePartsFormatter.formatToParts(date)
      .filter(p => p.type !== 'literal')
      .map(p => [p.type, p.value]),
  ) as Record<string, string>

  const year = Number(parts.year)
  const month = Number(parts.month)
  const day = Number(parts.day)
  const offset = CHICAGO_WEEKDAY_OFFSET[parts.weekday ?? '']
  if (!year || !month || !day || offset === undefined) return null

  // Noon UTC keeps calendar-day arithmetic stable across DST when we only care about Y-M-D.
  const monday = new Date(Date.UTC(year, month - 1, day - offset, 12, 0, 0))
  const y = monday.getUTCFullYear()
  const m = String(monday.getUTCMonth() + 1).padStart(2, '0')
  const d = String(monday.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isInCurrentChicagoWeek(iso: string, now = new Date()) {
  const eventWeek = chicagoWeekMondayKey(iso)
  const currentWeek = chicagoWeekMondayKey(now)
  return Boolean(eventWeek && currentWeek && eventWeek === currentWeek)
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIMEZONE,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_TIMEZONE,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** Date only — officer list, compact views. */
export function formatEventDate(iso: string) {
  const date = parseInstant(iso)
  return date ? dateFormatter.format(date) : iso
}

/** Time only in Central. */
export function formatEventTime(iso: string) {
  const date = parseInstant(iso)
  return date ? timeFormatter.format(date) : iso
}

/** Date + start time for member Events page. Pass `dateOnly` for day-long / virtual awards. */
export function formatEventSchedule(
  startsAt: string,
  endsAt?: string | null,
  options?: { dateOnly?: boolean },
) {
  const start = parseInstant(startsAt)
  if (!start) return startsAt

  const dateLabel = dateFormatter.format(start)
  if (options?.dateOnly) return dateLabel

  const startTime = timeFormatter.format(start)

  if (!endsAt) {
    return `${dateLabel} · ${startTime}`
  }

  const end = parseInstant(endsAt)
  if (!end) {
    return `${dateLabel} · ${startTime}`
  }

  const endTime = timeFormatter.format(end)
  const sameDay = dateFormatter.format(start) === dateFormatter.format(end)
  return sameDay
    ? `${dateLabel} · ${startTime} – ${endTime}`
    : `${dateLabel} · ${startTime} – ${dateFormatter.format(end)} ${endTime}`
}

/** Full datetime — officer event detail, check-in pages. */
export function formatEventDateTime(iso: string) {
  const date = parseInstant(iso)
  return date ? dateTimeFormatter.format(date) : iso
}

/** Past when the event has ended. Uses `endsAt` when present so day-long events stay upcoming until EOD. */
export function isEventPast(startsAt: string, endsAt?: string | null) {
  const end = endsAt ? parseInstant(endsAt) : null
  if (end) return end < new Date()
  const start = parseInstant(startsAt)
  return start ? start < new Date() : false
}

function startsAtMs(iso: string) {
  return parseInstant(iso)?.getTime() ?? 0
}

/** Sort by event start time. */
export function sortEventsByStartsAt<T extends { starts_at: string }>(
  events: T[],
  direction: 'asc' | 'desc' = 'asc',
): T[] {
  return [...events].sort((a, b) => {
    const diff = startsAtMs(a.starts_at) - startsAtMs(b.starts_at)
    return direction === 'asc' ? diff : -diff
  })
}

/** Upcoming soonest-first, then past most-recent-first. */
export function sortEventsForDisplay<
  T extends { starts_at: string; ends_at?: string | null },
>(events: T[]): T[] {
  const upcoming = sortEventsByStartsAt(
    events.filter(e => !isEventPast(e.starts_at, e.ends_at)),
    'asc',
  )
  const past = sortEventsByStartsAt(
    events.filter(e => isEventPast(e.starts_at, e.ends_at)),
    'desc',
  )
  return [...upcoming, ...past]
}
