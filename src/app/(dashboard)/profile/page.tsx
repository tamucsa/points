import { redirect } from 'next/navigation'
import ProfileClient from '@/app/(dashboard)/profile/components/ProfileClient'
import { getActiveSemester, getCurrentMember } from '@/utils/supabase/auth'

export default async function ProfilePage() {
  const [{ supabase, user, member }, semester] = await Promise.all([
    getCurrentMember(),
    getActiveSemester(),
  ])

  if (!user) redirect('/')
  if (!member) redirect('/')

  const [{ data: points }, { data: attendance }, { data: history }] = await Promise.all([
    supabase
      .from('v_current_leaderboard')
      .select('total_points, csa_points, jt_points, sports_points, gm_points, jt_family, jt_color')
      .eq('id', member.id)
      .single(),
    supabase
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
          starts_at,
          ends_at
        )
      `)
      .eq('member_id', member.id)
      .eq('semester_id', semester?.id ?? '00000000-0000-0000-0000-000000000000')
      .order('recorded_at', { ascending: false }),
    supabase
      .from('semester_summaries')
      .select('*, semesters(name)')
      .eq('member_id', member.id)
      .order('created_at', { ascending: false }),
  ])

  const normalizedAttendance = (attendance ?? []).map((row) => ({
    ...row,
    events: Array.isArray(row.events)
      ? (row.events[0] ?? {
          name: '',
          category: '',
          point_value: 0,
          starts_at: '',
          ends_at: null,
        })
      : row.events,
  }))

  return (
    <ProfileClient
      member={{
        id: member.id,
        full_name: member.full_name,
        profile_image_url: member.profile_image_url,
        graduation_year: member.graduation_year ?? null,
      }}
      points={points}
      attendance={normalizedAttendance}
      history={history ?? []}
      semesterName={semester?.name ?? null}
    />
  )
}
