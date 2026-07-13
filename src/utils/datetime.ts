export const EVENT_TIMEZONE = 'America/Chicago'

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

function parseInstant(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

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

/** Date + start time for member Events page. */
export function formatEventSchedule(startsAt: string, endsAt?: string | null) {
  const start = parseInstant(startsAt)
  if (!start) return startsAt

  const dateLabel = dateFormatter.format(start)
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

export function isEventPast(startsAt: string) {
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
export function sortEventsForDisplay<T extends { starts_at: string }>(events: T[]): T[] {
  const upcoming = sortEventsByStartsAt(
    events.filter(e => !isEventPast(e.starts_at)),
    'asc',
  )
  const past = sortEventsByStartsAt(
    events.filter(e => isEventPast(e.starts_at)),
    'desc',
  )
  return [...upcoming, ...past]
}
