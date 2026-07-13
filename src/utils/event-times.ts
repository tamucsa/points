import type { SupabaseClient } from '@supabase/supabase-js'
import { EVENT_TIMEZONE } from '@/utils/datetime'

export async function resolveCentralEventTimestamp(
  supabase: SupabaseClient,
  date: string,
  time: string,
) {
  const { data, error } = await supabase.rpc('central_event_timestamp', {
    p_date: date,
    p_time: time.length === 5 ? `${time}:00` : time,
  })

  if (error || !data) return { value: null, error: error?.message ?? 'Invalid date or time.' }
  return { value: data as string, error: null }
}

export function validateEventEndAfterStart(startsAt: string, endsAt: string) {
  return new Date(endsAt).getTime() > new Date(startsAt).getTime()
}

/** Split stored timestamptz into HTML date/time inputs (America/Chicago). */
export function eventTimestampToFormDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: EVENT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)

  const year = parts.find(p => p.type === 'year')?.value ?? ''
  const month = parts.find(p => p.type === 'month')?.value ?? ''
  const day = parts.find(p => p.type === 'day')?.value ?? ''
  return `${year}-${month}-${day}`
}

export function eventTimestampToFormTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: EVENT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d)
}
