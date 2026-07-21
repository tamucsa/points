'use client'

import { useRouter } from 'next/navigation'
import JtFamilyBadge from '@/app/(dashboard)/leaderboard/components/JtFamilyBadge'
import LeaderboardTabs from '@/app/(dashboard)/leaderboard/components/LeaderboardTabs'
import EmptyState from '@/app/components/EmptyState'
import PageHeader from '@/app/components/PageHeader'
import { AlertCircle, Medal } from 'lucide-react'

interface Snapshot {
  id: string
  label: string | null
  snapshot_at: string
}

interface StandingsRow {
  jt_family_name: string
  jt_color: string | null
  total_points: number
  rank: number
}

interface Props {
  semester: { name: string } | null
  snapshots: Snapshot[]
  selectedSnapshotId: string | null
  selectedSnapshot: Snapshot | null
  rows: StandingsRow[]
  loadError?: string | null
}

function formatSnapshotLabel(snapshot: Snapshot) {
  const date = new Date(snapshot.snapshot_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return snapshot.label ? `${snapshot.label} · ${date}` : date
}

export default function StandingsLeaderboardClient({
  semester,
  snapshots,
  selectedSnapshotId,
  selectedSnapshot,
  rows,
  loadError = null,
}: Props) {
  const router = useRouter()

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 lg:px-8">
      <PageHeader
        title="Leaderboard"
        subtitle={`${semester?.name ?? 'Current Semester'} · Jiating standings after General Meeting`}
        className="mb-2"
      />

      <LeaderboardTabs />

      {!loadError && snapshots.length > 1 && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em] text-subtitle">
            Snapshot
          </label>
          <select
            value={selectedSnapshotId ?? ''}
            onChange={e => {
              const id = e.target.value
              router.push(id ? `/leaderboard/standings?snapshot=${id}` : '/leaderboard/standings')
            }}
            className="w-full rounded-xl border border-home-border bg-surface px-3 py-2.5 text-sm text-text shadow-sm"
          >
            {snapshots.map(snapshot => (
              <option key={snapshot.id} value={snapshot.id}>
                {formatSnapshotLabel(snapshot)}
              </option>
            ))}
          </select>
        </div>
      )}

      {!loadError && selectedSnapshot && (
        <p className="mb-4 text-xs text-subtitle">
          As of {new Date(selectedSnapshot.snapshot_at).toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
          {' '}· Standings are not live; the secretary will publish after each General Meeting.
        </p>
      )}

      <div className="overflow-hidden rounded-4xl border border-home-border bg-surface shadow-theme-md">
        <div className="grid grid-cols-[2.5rem_1fr_4rem] border-b border-home-border bg-bg px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtitle">
          <div>#</div>
          <div>Jiating</div>
          <div className="text-right">Total</div>
        </div>

        {loadError ? (
          <EmptyState
            icon={AlertCircle}
            title="Couldn’t load standings"
            description="Refresh the page to try again."
            compact
            className="px-8 py-12"
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Medal}
            title="No standings published yet for this semester"
            description="Jiating standings will be published after the first general meeting after registration closes."
            compact
            className="px-8 py-12"
          />
        ) : (
          rows.map(row => (
            <div
              key={row.jt_family_name}
              className="grid grid-cols-[2.5rem_1fr_4rem] items-center border-b border-home-border px-5 py-4 last:border-b-0"
            >
              <div className="text-sm font-bold text-primary">{row.rank}</div>
              <div>
                <JtFamilyBadge name={row.jt_family_name} color={row.jt_color} />
              </div>
              <div className="text-right text-sm font-bold text-text">{row.total_points}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
