import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import EventDetailClient from '@/app/(dashboard)/(officer)/officer/events/components/EventDetailClient'

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', params.id)
    .single()

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
    .eq('event_id', params.id)
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