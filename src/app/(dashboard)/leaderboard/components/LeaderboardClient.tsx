'use client'

import JtFamilyBadge from '@/app/(dashboard)/leaderboard/components/JtFamilyBadge'
import MemberAvatar from '@/app/components/MemberAvatar'
import LeaderboardTabs from '@/app/(dashboard)/leaderboard/components/LeaderboardTabs'

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
}

export default function LeaderboardClient({ members, semester }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-8 lg:px-8">
      <div className="mb-2">
        <h1 className="text-3xl font-bold tracking-tight text-text">Leaderboard</h1>
        <div className="mt-1 text-sm text-subtitle">
          {semester?.name ?? 'Current Semester'} · Top 10
        </div>
      </div>

      <LeaderboardTabs />

      <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-[3rem_1fr_4rem] border-b border-home-border bg-bg px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtitle">
          <div>#</div>
          <div>Member</div>
          <div className="text-right">Total</div>
        </div>

        {members.length === 0 && (
          <div className="px-10 py-12 text-center text-sm text-subtitle">
            No active members yet.
          </div>
        )}

        {members.map((m, i) => {
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
