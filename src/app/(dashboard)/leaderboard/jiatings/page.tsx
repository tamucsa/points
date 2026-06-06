import JiatingsLeaderboardClient from '@/app/(dashboard)/leaderboard/components/JiatingsLeaderboardClient'
import { createServerSupabase } from '@/utils/supabase/server'

interface LeaderboardMember {
  id: string
  full_name: string
  preferred_name: string | null
  profile_image_url: string | null
  jt_family: string | null
  jt_color: string | null
  total_points: number
}

export default async function JiatingsLeaderboardPage() {
  const supabase = await createServerSupabase()

  const [{ data: families }, { data: members }, { data: semester }] = await Promise.all([
    supabase
      .from('jt_families')
      .select('id, name, color')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('v_current_leaderboard')
      .select('id, preferred_name, full_name, profile_image_url, jt_family, jt_color, total_points')
      .not('jt_family', 'is', null)
      .order('total_points', { ascending: false }),
    supabase.from('semesters').select('name').eq('is_active', true).maybeSingle(),
  ])

  const topByFamily = new Map<string, LeaderboardMember[]>()

  for (const member of members ?? []) {
    if (!member.jt_family) continue
    const list = topByFamily.get(member.jt_family) ?? []
    if (list.length < 3) list.push(member)
    topByFamily.set(member.jt_family, list)
  }

  const jiatings = (families ?? []).map(family => ({
    id: family.id,
    name: family.name,
    color: family.color,
    topMembers: (topByFamily.get(family.name) ?? []).map(member => ({
      id: member.id,
      full_name: member.full_name,
      preferred_name: member.preferred_name,
      profile_image_url: member.profile_image_url,
      jt_color: member.jt_color,
      total_points: member.total_points,
    })),
  }))

  return (
    <JiatingsLeaderboardClient
      jiatings={jiatings}
      semester={semester}
    />
  )
}
