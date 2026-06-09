import JiatingsLeaderboardClient from '@/app/(dashboard)/leaderboard/components/JiatingsLeaderboardClient'
import { getActiveSemester } from '@/utils/supabase/auth'
import { createServerSupabase } from '@/utils/supabase/server'

const TOP_MEMBER_COLUMNS =
  'id, preferred_name, full_name, profile_image_url, jt_color, total_points'

export default async function JiatingsLeaderboardPage() {
  const supabase = await createServerSupabase()

  const [{ data: families }, semester] = await Promise.all([
    supabase
      .from('jt_families')
      .select('id, name, color')
      .eq('is_active', true)
      .order('name'),
    getActiveSemester(),
  ])

  const topMemberResults = await Promise.all(
    (families ?? []).map(family =>
      supabase
        .from('v_current_leaderboard')
        .select(TOP_MEMBER_COLUMNS)
        .eq('jt_family', family.name)
        .order('total_points', { ascending: false })
        .limit(3),
    ),
  )

  const jiatings = (families ?? []).map((family, index) => ({
    id: family.id,
    name: family.name,
    color: family.color,
    topMembers: topMemberResults[index]?.data ?? [],
  }))

  return (
    <JiatingsLeaderboardClient
      jiatings={jiatings}
      semester={semester ? { name: semester.name } : null}
    />
  )
}
