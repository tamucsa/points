'use client'

import JtFamilyBadge from '@/app/(dashboard)/leaderboard/components/JtFamilyBadge'
import MemberAvatar from '@/app/components/MemberAvatar'
import EmptyState from '@/app/components/EmptyState'
import PageHeader from '@/app/components/PageHeader'
import LeaderboardTabs from '@/app/(dashboard)/leaderboard/components/LeaderboardTabs'
import { AlertCircle, Users } from 'lucide-react'

interface Member {
  id: string
  full_name: string
  profile_image_url: string | null
  jt_family: string | null
  jt_color: string | null
  total_points: number
}

interface Props {
  members: Member[]
  semester: { name: string } | null
  loadError?: string | null
}

export default function LeaderboardClient({ members, semester, loadError = null }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8 lg:px-8">
      <PageHeader
        title="Leaderboard"
        subtitle={`${semester?.name ?? 'Current Semester'} · Top 10`}
        className="mb-2"
      />

      <LeaderboardTabs />

      <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-[3rem_1fr_4rem] border-b border-home-border bg-bg px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtitle">
          <div>#</div>
          <div>Member</div>
          <div className="text-right">Total</div>
        </div>

        {loadError && (
          <EmptyState
            icon={AlertCircle}
            title="Couldn’t load leaderboard"
            description="Refresh the page to try again."
            compact
            className="px-10 py-12"
          />
        )}

        {!loadError && members.length === 0 && (
          <EmptyState
            icon={Users}
            title="No active members yet"
            description="Members will appear here once they're activated for the semester."
            compact
            className="px-10 py-12"
          />
        )}

        {!loadError && members.map((m, i) => {
          const displayName = m.full_name

          return (
            <div
              key={m.id}
              className="grid grid-cols-[3rem_1fr_4rem] items-center border-b border-home-border px-5 py-4 last:border-b-0"
            >
              <div className="text-sm font-bold text-primary">{i + 1}</div>
              <div className="flex min-w-0 items-center gap-3">
                <MemberAvatar
                  name={displayName}
                  profileImageUrl={m.profile_image_url}
                  color={m.jt_color}
                  bordered
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-text">{displayName}</div>
                  {m.jt_family && (
                    <div className="mt-1">
                      <JtFamilyBadge name={m.jt_family} color={m.jt_color} />
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right text-sm font-bold text-text">
                {m.total_points}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
