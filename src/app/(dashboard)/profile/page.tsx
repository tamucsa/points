import { redirect } from 'next/navigation'
import ProfileClient from '@/app/(dashboard)/profile/components/ProfileClient'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function ProfilePage() {
  const supabase = await createServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  // Get member row
  const { data: member } = await supabase
    .from('members')
    .select('id, full_name, profile_image_url, graduation_year')
    .eq('auth_uid', user.id)
    .single()

  if (!member) redirect('/')

  // Get their full point breakdown from the leaderboard view
  const { data: points } = await supabase
    .from('v_current_leaderboard')
    .select('total_points, csa_points, jt_points, sports_points, gm_points, jt_family, jt_color')
    .eq('id', member.id)
    .single()

  const { data: semester } = await supabase
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  const { data: attendance } = await supabase
    .from('attendance')
    .select(`
      id,
      recorded_at,
      check_in_method,
      counted,
      events (
        name,
        category,
        point_value,
        event_date
      )
    `)
    .eq('member_id', member.id)
    .eq('semester_id', semester?.id ?? '00000000-0000-0000-0000-000000000000')
    .order('recorded_at', { ascending: false })

  // Get their historical semester summaries
  const { data: history } = await supabase
    .from('semester_summaries')
    .select('*, semesters(name)')
    .eq('member_id', member.id)
    .order('created_at', { ascending: false })

  const normalizedAttendance = (attendance ?? []).map((row) => ({
    ...row,
    events: Array.isArray(row.events)
      ? (row.events[0] ?? {
          name: '',
          category: '',
          point_value: 0,
          event_date: '',
        })
      : row.events,
  }))

  return (
    <ProfileClient
      member={member}
      points={points}
      attendance={normalizedAttendance}
      history={history ?? []}
    />
  )
}