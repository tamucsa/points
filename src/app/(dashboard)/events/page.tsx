import { redirect } from 'next/navigation'
import MemberEventsClient from '@/app/(dashboard)/events/components/MemberEventsClient'
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

  // Get active semester
  const { data: semester } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .single()

  // Get all events for current semester visible to this member
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('semester_id', semester?.id)
    .or(`scope.in.(org,jt_shared),and(scope.eq.jt_specific,jt_family_id.eq.${member.jt_family_id})`)
    .order('event_date', { ascending: true })

  // Get member's attended event IDs this semester
  const { data: attended } = await supabase
    .from('attendance')
    .select('event_id')
    .eq('member_id', member.id)
    .eq('semester_id', semester?.id)

  const attendedIds = new Set(attended?.map(a => a.event_id) ?? [])

  return (
    <MemberEventsClient
      events={events ?? []}
      attendedIds={attendedIds}
      semester={semester}
    />
  )
}