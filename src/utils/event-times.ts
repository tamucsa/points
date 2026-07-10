import type { SupabaseClient } from '@supabase/supabase-js'

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
