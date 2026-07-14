import LeaderboardClient from '@/app/(dashboard)/leaderboard/components/LeaderboardClient'
import { getActiveSemester, getAuthUser } from '@/utils/supabase/auth'

export default async function LeaderboardPage() {
  const { supabase } = await getAuthUser()

  const [{ data: members, error: membersError }, semester] = await Promise.all([
    supabase
      .from('v_current_leaderboard')
      .select('id, full_name, profile_image_url, jt_family, jt_color, total_points')
      .order('total_points', { ascending: false })
      .limit(10),
    getActiveSemester(),
  ])

  if (membersError) {
    console.error('Failed to load leaderboard:', membersError.message)
  }

  return (
    <LeaderboardClient
      members={membersError ? [] : (members ?? [])}
      semester={semester ? { name: semester.name } : null}
      loadError={membersError?.message ?? null}
    />
  )
}
