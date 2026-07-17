import { notFound, redirect } from 'next/navigation'
import MemberDetailClient from '@/app/(dashboard)/(officer)/officer/members/components/MemberDetailClient'
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

  const { data: attendance } = await supabase
    .from('attendance')
    .select(`
      id,
      check_in_method,
      verified,
      counted,
      recorded_at,
      point_value_override,
      events (
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
    .order('recorded_at', { ascending: false })

  const { data: history } = await supabase
    .from('semester_summaries')
    .select('*, semesters(name)')
    .eq('member_id', id)
    .order('created_at', { ascending: false })

  return (
    <MemberDetailClient
      member={member}
      attendance={(attendance ?? []) as unknown as Parameters<typeof MemberDetailClient>[0]['attendance']}
      history={history ?? []}
    />
  )
}
