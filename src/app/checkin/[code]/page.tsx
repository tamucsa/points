import { notFound } from 'next/navigation'
import CheckinClient from '@/app/checkin/[code]/components/CheckinClient'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function CheckinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createServerSupabase()

  const { data: event } = await supabase
    .from('events')
    .select('id, name, category, point_value, starts_at, ends_at, location, location_maps_url, check_in_type, semester_id')
    .eq('check_in_code', code)
    .eq('check_in_type', 'self')
    .maybeSingle()

  if (!event) notFound()

  const { data: { user } } = await supabase.auth.getUser()

  let member: { id: string; status: string; full_name: string } | null = null
  let alreadyCheckedIn = false

  if (user) {
    const { data: memberRow } = await supabase
      .from('members')
      .select('id, status, full_name')
      .eq('auth_uid', user.id)
      .maybeSingle()

    member = memberRow

    if (memberRow) {
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('member_id', memberRow.id)
        .eq('event_id', event.id)
        .maybeSingle()

      alreadyCheckedIn = !!existing
    }
  }

  return (
    <CheckinClient
      event={event}
      code={code}
      userEmail={user?.email ?? null}
      member={member}
      alreadyCheckedIn={alreadyCheckedIn}
    />
  )
}
