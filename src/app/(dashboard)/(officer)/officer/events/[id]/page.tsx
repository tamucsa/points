import { notFound, redirect } from 'next/navigation'
import EventDetailClient from '@/app/(dashboard)/(officer)/officer/events/components/EventDetailClient'
import { getSnapshotForEvent } from '@/app/actions/jt-standings'
import { isMixerCategory } from '@/utils/events'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!event) notFound()

  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select(`
      id,
      member_id,
      check_in_method,
      verified,
      counted,
      recorded_at,
      members!attendance_member_id_fkey (
        id,
        full_name,
        profile_image_url
      )
    `)
    .eq('event_id', id)
    .order('recorded_at', { ascending: false })

  if (attendanceError) {
    console.error('Failed to load event attendance:', attendanceError.message)
  }

  const normalizedAttendance = (attendance ?? []).map((row) => ({
    ...row,
    members: Array.isArray(row.members) ? row.members[0] : row.members,
  }))

  const publishedSnapshot = await getSnapshotForEvent(id)

  let jtFamilies: { id: string; name: string }[] = []
  let mixerFamilyIds: string[] = []
  let spectatorEvent: {
    id: string
    name: string
    check_in_code: string | null
    point_value: number
  } | null = null

  if (isMixerCategory(event.category)) {
    const [{ data: families }, { data: links }] = await Promise.all([
      supabase
        .from('jt_families')
        .select('id, name')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('event_jt_families')
        .select('jt_family_id')
        .eq('event_id', id),
    ])

    jtFamilies = families ?? []
    mixerFamilyIds = (links ?? []).map(row => row.jt_family_id)
  }

  const { data: spectator } = await supabase
    .from('events')
    .select('id, name, check_in_code, point_value')
    .eq('parent_event_id', id)
    .maybeSingle()

  if (spectator) {
    spectatorEvent = spectator
  }

  return (
    <EventDetailClient
      event={event}
      attendance={normalizedAttendance}
      publishedSnapshot={publishedSnapshot}
      jtFamilies={jtFamilies}
      mixerFamilyIds={mixerFamilyIds}
      spectatorEvent={spectatorEvent}
    />
  )
}
