import JiatingsLeaderboardClient from '@/app/(dashboard)/leaderboard/components/JiatingsLeaderboardClient'
import { getActiveSemester, getAuthUser } from '@/utils/supabase/auth'

type LeaderboardMember = {
  id: string
  full_name: string
  profile_image_url: string | null
  jt_family: string | null
  jt_color: string | null
  total_points: number
}

export default async function JiatingsLeaderboardPage() {
  const { supabase } = await getAuthUser()

  const [
    { data: families, error: familiesError },
    { data: leaders, error: leadersError },
    semester,
  ] = await Promise.all([
    supabase
      .from('jt_families')
      .select('id, name, color')
      .eq('is_active', true)
      .order('name'),
    supabase.rpc('top_leaderboard_members_per_jt', { p_limit: 3 }),
    getActiveSemester(),
  ])

  const loadError = familiesError?.message ?? leadersError?.message ?? null
  if (loadError) {
    console.error('Failed to load Jiatings leaderboard:', loadError)
  }

  const byFamily = new Map<string, LeaderboardMember[]>()
  for (const row of (leaders ?? []) as LeaderboardMember[]) {
    if (!row.jt_family) continue
    const list = byFamily.get(row.jt_family) ?? []
    list.push(row)
    byFamily.set(row.jt_family, list)
  }

  const jiatings = loadError
    ? []
    : (families ?? []).map(family => ({
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
      loadError={loadError}
    />
  )
}
