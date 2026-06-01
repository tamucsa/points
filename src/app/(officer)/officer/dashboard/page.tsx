import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import OfficerDashboardClient from '@/app/(officer)/officer/dashboard/components/OfficerDashboardClient'

export default async function OfficerDashboardPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: semester } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .single()

  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('semester_id', semester?.id)
    .order('event_date', { ascending: false })

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
    <OfficerDashboardClient
      events={events ?? []}
      attendanceCounts={attendanceCounts}
      semester={semester}
    />
  )
}