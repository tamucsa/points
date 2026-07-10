import StandingsLeaderboardClient from '@/app/(dashboard)/leaderboard/standings/components/StandingsLeaderboardClient'
import { getActiveSemester } from '@/utils/supabase/auth'
import { createServerSupabase } from '@/utils/supabase/server'

interface SearchParams {
  snapshot?: string
}

export default async function StandingsLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { snapshot: snapshotParam } = await searchParams
  const supabase = await createServerSupabase()
  const semester = await getActiveSemester()

  let snapshotsQuery = supabase
    .from('jt_leaderboard_snapshots')
    .select('id, label, snapshot_at, source_event_id')
    .order('snapshot_at', { ascending: false })

  if (semester?.id) {
    snapshotsQuery = snapshotsQuery.eq('semester_id', semester.id)
  }

  const { data: snapshots } = await snapshotsQuery

  const selectedId = snapshotParam ?? snapshots?.[0]?.id ?? null

  const { data: rows } = selectedId
    ? await supabase
        .from('jt_leaderboard_snapshot_rows')
        .select('jt_family_name, jt_color, total_points, rank')
        .eq('snapshot_id', selectedId)
        .order('rank', { ascending: true })
    : { data: [] }

  const selectedSnapshot = snapshots?.find(s => s.id === selectedId) ?? null

  return (
    <StandingsLeaderboardClient
      semester={semester ? { name: semester.name } : null}
      snapshots={snapshots ?? []}
      selectedSnapshotId={selectedId}
      selectedSnapshot={selectedSnapshot}
      rows={rows ?? []}
    />
  )
}
