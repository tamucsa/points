import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import MemberDetailClient from '@/app/(dashboard)/(officer)/officer/members/components/MemberDetailClient'

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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

  const { data: member } = await supabase
    .from('v_current_leaderboard')
    .select('*')
    .eq('id', id)
    .single()

  if (!member) notFound()

  const { data: attendance } = await supabase
    .from('attendance')
    .select(`
      id,
      check_in_method,
      verified,
      counted,
      recorded_at,
      events (
        name,
        category,
        point_value,
        event_date
      )
    `)
    .eq('member_id', id)
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