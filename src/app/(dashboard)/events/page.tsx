import { redirect } from 'next/navigation'
import MemberEventsClient from '@/app/(dashboard)/events/components/MemberEventsClient'
import { isMixerCategory } from '@/utils/events'
import { getActiveSemester, getCurrentMember } from '@/utils/supabase/auth'

export default async function MemberEventsPage() {
  const [{ supabase, user, member }, semester] = await Promise.all([
    getCurrentMember(),
    getActiveSemester(),
  ])

  if (!user) redirect('/')
  if (!member) redirect('/')

  // Hide Spectator (and any other) child events — members see the parent Sports row only.
  let eventsQuery = supabase
    .from('events')
    .select('*')
    .eq('semester_id', semester?.id)
    .is('parent_event_id', null)
    .order('starts_at', { ascending: true })

  // Without a Jiating, only CSA-wide and JT-shared events (mixers filtered below).
  if (member.jt_family_id) {
    eventsQuery = eventsQuery.or(
      `scope.in.(org,jt_shared),and(scope.eq.jt_specific,jt_family_id.eq.${member.jt_family_id})`,
    )
  } else {
    eventsQuery = eventsQuery.in('scope', ['org', 'jt_shared'])
  }

  const { data: events } = await eventsQuery

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
    .select('event_id, events(parent_event_id)')
    .eq('member_id', member.id)
    .eq('semester_id', semester?.id)

  // Spectator check-in is on the child event; still mark the parent Sports card as attended.
  const attendedIds = new Set<string>()
  for (const row of attended ?? []) {
    attendedIds.add(row.event_id)
    const linked = Array.isArray(row.events) ? row.events[0] : row.events
    if (linked?.parent_event_id) {
      attendedIds.add(linked.parent_event_id)
    }
  }

  return (
    <MemberEventsClient
      events={visibleEvents}
      attendedIds={attendedIds}
      semester={semester}
    />
  )
}
