import { notFound, redirect } from 'next/navigation'
import MemberDetailClient from '@/app/(dashboard)/(officer)/officer/members/components/MemberDetailClient'
import { earnsRewards } from '@/utils/members'
import { buildGmRewardProgress, type GmRewardProgress } from '@/utils/rewards'
import { isCultureQuizPlace } from '@/utils/culture-quiz'
import { getActiveSemester, getAuthUser } from '@/utils/supabase/auth'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user } = await getAuthUser()
  if (!user) redirect('/')

  const { data: member } = await supabase
    .from('v_current_leaderboard')
    .select('*')
    .eq('id', id)
    .single()

  if (!member) notFound()

  const semester = await getActiveSemester()
  const showReward = earnsRewards({
    role: member.role,
    is_parent: member.is_parent,
  })

  const [attendanceResult, recapResult, historyResult, cultureQuizResult] = await Promise.all([
    supabase
      .from('attendance')
      .select(`
        id,
        check_in_method,
        verified,
        counted,
        recorded_at,
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
      .eq('member_id', id)
      .eq('semester_id', semester?.id ?? '00000000-0000-0000-0000-000000000000')
      .order('recorded_at', { ascending: false }),
    showReward && semester
      ? supabase
          .from('gm_recap_submissions')
          .select('event_id, events(id, name, starts_at)')
          .eq('member_id', id)
          .eq('semester_id', semester.id)
          .eq('is_guest', false)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('semester_summaries')
      .select('*, semesters(name)')
      .eq('member_id', id)
      .order('created_at', { ascending: false }),
    semester
      ? supabase
          .from('gm_culture_quiz_results')
          .select('event_id, place, points')
          .eq('member_id', id)
          .eq('semester_id', semester.id)
      : Promise.resolve({ data: [], error: null }),
  ])

  const attendance = attendanceResult.data
  const history = historyResult.data

  const gmReward: GmRewardProgress | null = showReward
    ? buildGmRewardProgress({
        attendance: (attendance ?? []).map(row => {
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

  const cultureQuizByEvent = new Map<string, { place: number; points: number }>()
  if (!cultureQuizResult.error) {
    for (const row of cultureQuizResult.data ?? []) {
      if (!isCultureQuizPlace(row.place)) continue
      cultureQuizByEvent.set(row.event_id, {
        place: row.place,
        points: row.points,
      })
    }
  }

  const attendanceRows = (attendance ?? []).map(row => {
    const event = Array.isArray(row.events) ? row.events[0] : row.events
    return {
      ...row,
      events: event,
      cultureQuiz: event?.id ? cultureQuizByEvent.get(event.id) ?? null : null,
    }
  })

  return (
    <MemberDetailClient
      member={member}
      attendance={attendanceRows as unknown as Parameters<typeof MemberDetailClient>[0]['attendance']}
      history={history ?? []}
      gmReward={gmReward}
      gmRewardLoadError={recapResult.error?.message ?? null}
    />
  )
}
