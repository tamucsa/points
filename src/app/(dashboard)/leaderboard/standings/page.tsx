import StandingsLeaderboardClient from '@/app/(dashboard)/leaderboard/standings/components/StandingsLeaderboardClient'
import { getActiveSemester, getAuthUser } from '@/utils/supabase/auth'

interface SearchParams {
  snapshot?: string
}

export default async function StandingsLeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { snapshot: snapshotParam } = await searchParams
  const { supabase } = await getAuthUser()
  const semester = await getActiveSemester()

  let snapshotsQuery = supabase
    .from('jt_leaderboard_snapshots')
    .select('id, label, snapshot_at, source_event_id')
    .order('snapshot_at', { ascending: false })

  if (semester?.id) {
    snapshotsQuery = snapshotsQuery.eq('semester_id', semester.id)
  }

  const { data: snapshots, error: snapshotsError } = await snapshotsQuery

  if (snapshotsError) {
    console.error('Failed to load standings snapshots:', snapshotsError.message)
  }

  const selectedId = snapshotParam ?? snapshots?.[0]?.id ?? null

  const { data: rows, error: rowsError } = selectedId && !snapshotsError
    ? await supabase
        .from('jt_leaderboard_snapshot_rows')
        .select('jt_family_name, jt_color, total_points, rank')
        .eq('snapshot_id', selectedId)
        .order('rank', { ascending: true })
    : { data: [] as never[], error: null }

  if (rowsError) {
    console.error('Failed to load standings rows:', rowsError.message)
  }

  const loadError = snapshotsError?.message ?? rowsError?.message ?? null
  const selectedSnapshot =
    !loadError ? (snapshots?.find(s => s.id === selectedId) ?? null) : null

  return (
    <StandingsLeaderboardClient
      semester={semester ? { name: semester.name } : null}
      snapshots={loadError ? [] : (snapshots ?? [])}
      selectedSnapshotId={loadError ? null : selectedId}
      selectedSnapshot={selectedSnapshot}
      rows={loadError ? [] : (rows ?? [])}
      loadError={loadError}
    />
  )
}
