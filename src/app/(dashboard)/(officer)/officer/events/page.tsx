import { redirect } from 'next/navigation'
import OfficerEventsClient from '@/app/(dashboard)/(officer)/officer/events/components/OfficerEventsClient'
import { isMixerCategory } from '@/utils/events'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function OfficerEventsPage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: member } = await supabase
    .from('members')
    .select('role, jt_family_id')
    .eq('auth_uid', user.id)
    .single()

  const { data: semester } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .single()

  const [{ data: events }, { data: spectatorEvents }, { data: jtFamilies }] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('semester_id', semester?.id)
      .is('parent_event_id', null)
      .order('starts_at', { ascending: true }),
    supabase
      .from('events')
      .select('id, name, check_in_code, check_in_type, parent_event_id, point_value, starts_at')
      .eq('semester_id', semester?.id)
      .not('parent_event_id', 'is', null),
    supabase
      .from('jt_families')
      .select('id, name, color')
      .eq('is_active', true)
      .order('name'),
  ])

  const spectatorByParentId = Object.fromEntries(
    (spectatorEvents ?? [])
      .filter(row => row.parent_event_id)
      .map(row => [row.parent_event_id as string, {
        id: row.id,
        name: row.name,
        check_in_code: row.check_in_code,
        check_in_type: row.check_in_type,
        point_value: row.point_value,
        starts_at: row.starts_at,
      }]),
  )

  const mixerIds = (events ?? []).filter(e => isMixerCategory(e.category)).map(e => e.id)
  const mixerFamiliesByEventId: Record<string, string[]> = {}
  if (mixerIds.length > 0) {
    const { data: links } = await supabase
      .from('event_jt_families')
      .select('event_id, jt_family_id')
      .in('event_id', mixerIds)

    for (const row of links ?? []) {
      const list = mixerFamiliesByEventId[row.event_id] ?? []
      list.push(row.jt_family_id)
      mixerFamiliesByEventId[row.event_id] = list
    }
  }

  const attendanceCounts: Record<string, number> = {}
  if (semester?.id) {
    const { data: counts } = await supabase.rpc('attendance_counts_for_semester', {
      p_semester_id: semester.id,
    })
    for (const row of counts ?? []) {
      attendanceCounts[row.event_id] = Number(row.attendance_count)
    }
  }

  return (
    <OfficerEventsClient
      events={events ?? []}
      attendanceCounts={attendanceCounts}
      semester={semester}
      isAdmin={member?.role === 'admin'}
      spectatorByParentId={spectatorByParentId}
      jtFamilies={jtFamilies ?? []}
      mixerFamiliesByEventId={mixerFamiliesByEventId}
      officerJtFamilyId={member?.jt_family_id ?? null}
    />
  )
}
