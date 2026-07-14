import JiatingsLeaderboardClient from '@/app/(dashboard)/leaderboard/components/JiatingsLeaderboardClient'
import { getActiveSemester } from '@/utils/supabase/auth'
import { createServerSupabase } from '@/utils/supabase/server'

const TOP_MEMBER_COLUMNS =
  'id, full_name, profile_image_url, jt_family, jt_color, total_points'

type LeaderboardMember = {
  id: string
  full_name: string
  profile_image_url: string | null
  jt_family: string | null
  jt_color: string | null
  total_points: number
}

export default async function JiatingsLeaderboardPage() {
  const supabase = await createServerSupabase()

  const [{ data: families }, { data: leaders }, semester] = await Promise.all([
    supabase
      .from('jt_families')
      .select('id, name, color')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('v_current_leaderboard')
      .select(TOP_MEMBER_COLUMNS)
      .order('total_points', { ascending: false }),
    getActiveSemester(),
  ])

  const byFamily = new Map<string, LeaderboardMember[]>()
  for (const row of (leaders ?? []) as LeaderboardMember[]) {
    if (!row.jt_family) continue
    const list = byFamily.get(row.jt_family) ?? []
    if (list.length < 3) {
      list.push(row)
      byFamily.set(row.jt_family, list)
    }
  }

  const jiatings = (families ?? []).map(family => ({
    id: family.id,
    name: family.name,
    color: family.color ?? '#4f6ef7',
    topMembers: (byFamily.get(family.name) ?? []).map(member => ({
      id: member.id,
      full_name: member.full_name,
      profile_image_url: member.profile_image_url,
      jt_color: member.jt_color,
      total_points: member.total_points,
    })),
  }))

  return (
    <JiatingsLeaderboardClient
      jiatings={jiatings}
      semester={semester ? { name: semester.name } : null}
    />
  )
}
