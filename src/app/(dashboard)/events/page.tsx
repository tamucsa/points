import { redirect } from 'next/navigation'
import MemberEventsClient from '@/app/(dashboard)/events/components/MemberEventsClient'
import { isMixerCategory } from '@/utils/events'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function MemberEventsPage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: member } = await supabase
    .from('members')
    .select('id, jt_family_id')
    .eq('auth_uid', user.id)
    .single()

  if (!member) redirect('/')

  const { data: semester } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .single()

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('semester_id', semester?.id)
    .or(`scope.in.(org,jt_shared),and(scope.eq.jt_specific,jt_family_id.eq.${member.jt_family_id})`)
    .order('starts_at', { ascending: true })

  const mixerIds = (events ?? [])
    .filter(e => isMixerCategory(e.category))
    .map(e => e.id)

  let mixerFamilyByEvent = new Map<string, Set<string>>()
  if (mixerIds.length > 0) {
    const { data: links } = await supabase
      .from('event_jt_families')
      .select('event_id, jt_family_id')
      .in('event_id', mixerIds)

    for (const row of links ?? []) {
      const set = mixerFamilyByEvent.get(row.event_id) ?? new Set<string>()
      set.add(row.jt_family_id)
      mixerFamilyByEvent.set(row.event_id, set)
    }
  }

  const visibleEvents = (events ?? []).filter(event => {
    if (!isMixerCategory(event.category)) return true
    const families = mixerFamilyByEvent.get(event.id)
    // Legacy mixers with no linked families stay visible to everyone.
    if (!families || families.size === 0) return true
    return !!member.jt_family_id && families.has(member.jt_family_id)
  })

  const { data: attended } = await supabase
    .from('attendance')
    .select('event_id')
    .eq('member_id', member.id)
    .eq('semester_id', semester?.id)

  const attendedIds = new Set(attended?.map(a => a.event_id) ?? [])

  return (
    <MemberEventsClient
      events={visibleEvents}
      attendedIds={attendedIds}
      semester={semester}
    />
  )
}
