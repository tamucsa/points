import { redirect } from 'next/navigation'
import OfficerEventsClient from '@/app/(dashboard)/(officer)/officer/events/components/OfficerEventsClient'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function OfficerEventsPage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: member } = await supabase
    .from('members')
    .select('role')
    .eq('auth_uid', user.id)
    .single()

  const { data: semester } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .single()

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('semester_id', semester?.id)
    .is('parent_event_id', null)       // hide spectator child events from main list
    .order('starts_at', { ascending: true })

  // Get attendance counts per event
  const { data: counts } = await supabase
    .from('attendance')
    .select('event_id')
    .eq('semester_id', semester?.id)

  const attendanceCounts = (counts ?? []).reduce((acc, row) => {
    acc[row.event_id] = (acc[row.event_id] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <OfficerEventsClient
      events={events ?? []}
      attendanceCounts={attendanceCounts}
      semester={semester}
      isAdmin={member?.role === 'admin'}
    />
  )
}