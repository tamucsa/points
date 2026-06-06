import { notFound, redirect } from 'next/navigation'
import EventDetailClient from '@/app/(dashboard)/(officer)/officer/events/components/EventDetailClient'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!event) notFound()

  // Get attendance list for this event
  const { data: attendance } = await supabase
    .from('attendance')
    .select(`
      id,
      check_in_method,
      verified,
      counted,
      recorded_at,
      members (
        id,
        full_name,
        preferred_name,
        profile_image_url
      )
    `)
    .eq('event_id', id)
    .order('recorded_at', { ascending: false })

  const normalizedAttendance = (attendance ?? []).map((row) => ({
    ...row,
    members: Array.isArray(row.members) ? row.members[0] : row.members,
  }))

  return (
    <EventDetailClient
      event={event}
      attendance={normalizedAttendance}
    />
  )
}