import LeaderboardClient from '@/app/(dashboard)/leaderboard/components/LeaderboardClient'
import { getActiveSemester } from '@/utils/supabase/auth'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function LeaderboardPage() {
  const supabase = await createServerSupabase()

  const [{ data: members }, semester] = await Promise.all([
    supabase
      .from('v_current_leaderboard')
      .select('id, preferred_name, full_name, profile_image_url, jt_family, jt_color, total_points')
      .order('total_points', { ascending: false })
      .limit(10),
    getActiveSemester(),
  ])

  return (
    <LeaderboardClient
      members={members ?? []}
      semester={semester ? { name: semester.name } : null}
    />
  )
}
