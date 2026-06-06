import LeaderboardClient from '@/app/(dashboard)/leaderboard/components/LeaderboardClient'
import { createServerSupabase } from '@/utils/supabase/server'

export default async function LeaderboardPage() {
  const supabase = await createServerSupabase()

  const [{ data: members }, { data: semester }] = await Promise.all([
    supabase
      .from('v_current_leaderboard')
      .select('id, preferred_name, full_name, profile_image_url, jt_family, jt_color, total_points')
      .order('total_points', { ascending: false })
      .limit(10),
    supabase.from('semesters').select('name').eq('is_active', true).maybeSingle(),
  ])

  return (
    <LeaderboardClient
      members={members ?? []}
      semester={semester}
    />
  )
}
