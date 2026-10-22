import { redirect } from 'next/navigation'
import ProfileClient from '@/app/(dashboard)/profile/components/ProfileClient'
import { earnsRewards } from '@/utils/members'
import { buildGmRewardProgress, type GmRewardProgress } from '@/utils/rewards'
import { getActiveSemester, getCurrentMember } from '@/utils/supabase/auth'

export default async function ProfilePage() {
  const [{ supabase, user, member }, semester] = await Promise.all([
    getCurrentMember(),
    getActiveSemester(),
  ])

  if (!user) redirect('/')
  if (!member) redirect('/')

  const showReward = earnsRewards(member)
  const [
    { data: points, error: pointsError },
    { data: attendance, error: attendanceError },
    { data: history, error: historyError },
    recapResult,
  ] = await Promise.all([
    supabase
      .from('v_current_leaderboard')
      .select('total_points, csa_points, jt_points, sports_points, gm_points, jt_family, jt_color')
      .eq('id', member.id)
      .maybeSingle(),
    supabase
      .from('attendance')
      .select(`
        id,
        recorded_at,
        check_in_method,
        counted,
        point_value_override,
        events (
          id,
          name,
          category,
          point_value,
          starts_at,
          ends_at,
          check_in_type
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
    showReward && semester
      ? supabase
          .from('gm_recap_submissions')
          .select('event_id, events(id, name, starts_at)')
          .eq('member_id', member.id)
          .eq('semester_id', semester.id)
          .eq('is_guest', false)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (pointsError) console.error('Failed to load profile points:', pointsError.message)
  if (attendanceError) console.error('Failed to load profile attendance:', attendanceError.message)
  if (historyError) console.error('Failed to load profile history:', historyError.message)
  if (recapResult.error) {
    console.error('Failed to load recap quiz credit:', recapResult.error.message)
  }

  const gmReward: GmRewardProgress | null = showReward
    ? buildGmRewardProgress({
        attendance: (attendanceError ? [] : attendance ?? []).map(row => {
          const event = Array.isArray(row.events) ? row.events[0] : row.events
          return {
            eventId: event?.id ?? '',
            name: event?.name ?? '',
            category: event?.category ?? '',
            startsAt: event?.starts_at ?? null,
          }
        }),
        recapMeetings: (recapResult.error ? [] : recapResult.data ?? []).map(row => {
          const event = Array.isArray(row.events) ? row.events[0] : row.events
          return {
            eventId: row.event_id,
            name: event?.name ?? 'General Meeting',
            startsAt: event?.starts_at ?? null,
          }
        }),
      })
    : null

  const normalizedAttendance = attendanceError
    ? []
    : (attendance ?? []).map((row) => ({
        ...row,
        events: Array.isArray(row.events)
          ? (row.events[0] ?? {
              id: '',
              name: '',
              category: '',
              point_value: 0,
              starts_at: '',
              ends_at: null,
              check_in_type: '',
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
        role: member.role,
        is_parent: member.is_parent,
      }}
      points={pointsError ? null : points}
      attendance={normalizedAttendance}
      history={historyError ? [] : (history ?? [])}
      semesterName={semester?.name ?? null}
      pointsLoadError={pointsError?.message ?? null}
      attendanceLoadError={attendanceError?.message ?? null}
      historyLoadError={historyError?.message ?? null}
      gmReward={gmReward}
      gmRewardLoadError={recapResult.error?.message ?? null}
    />
  )
}
