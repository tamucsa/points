import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import LeaderboardClient from '@/app/(dashboard)/leaderboard/components/LeaderboardClient'

export default async function LeaderboardPage() {
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

  const [{ data: members }, { data: jt }, { data: semester }] = await Promise.all([
    supabase.from('v_current_leaderboard').select('*'),
    supabase.from('v_jt_leaderboard').select('*'),
    supabase.from('semesters').select('*').eq('is_active', true).single(),
  ])

  return (
    <LeaderboardClient
      members={members ?? []}
      jtTotals={jt ?? []}
      semester={semester}
    />
  )
}