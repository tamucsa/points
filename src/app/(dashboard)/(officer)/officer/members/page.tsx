import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import MembersClient from '@/app/(dashboard)/(officer)/officer/members/components/MembersClient'

export default async function MembersPage() {
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

  const { data: members } = await supabase
    .from('v_current_leaderboard')
    .select('*')
    .order('total_points', { ascending: false })

  const { data: semester } = await supabase
    .from('semesters')
    .select('name')
    .eq('is_active', true)
    .single()

  return (
    <MembersClient
      members={members ?? []}
      semester={semester}
    />
  )
}