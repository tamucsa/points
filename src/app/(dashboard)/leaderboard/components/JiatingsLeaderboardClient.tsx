'use client'

import JtFamilyBadge from '@/app/(dashboard)/leaderboard/components/JtFamilyBadge'
import LeaderboardMemberAvatar from '@/app/(dashboard)/leaderboard/components/LeaderboardMemberAvatar'
import LeaderboardTabs from '@/app/(dashboard)/leaderboard/components/LeaderboardTabs'

interface TopMember {
  id: string
  full_name: string
  preferred_name: string | null
  profile_image_url: string | null
  jt_color: string | null
  total_points: number
}

interface JiatingCard {
  id: string
  name: string
  color: string
  topMembers: TopMember[]
}

interface Props {
  jiatings: JiatingCard[]
  semester: { name: string } | null
}

export default function JiatingsLeaderboardClient({ jiatings, semester }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <div className="mb-2">
        <h1 className="text-3xl font-bold tracking-tight text-text">Leaderboard</h1>
        <div className="mt-1 text-sm text-subtitle">
          {semester?.name ?? 'Current Semester'} · Top 3 per Jiating
        </div>
      </div>

      <LeaderboardTabs />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {jiatings.map(jiating => (
          <div
            key={jiating.id}
            className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
          >
            <div
              className="border-b border-home-border px-5 py-4"
              style={{ background: `${jiating.color}12` }}
            >
              <JtFamilyBadge name={jiating.name} color={jiating.color} />
            </div>

            {jiating.topMembers.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-subtitle">
                No members yet.
              </div>
            ) : (
              <div>
                {jiating.topMembers.map((member, i) => {
                  const displayName = member.preferred_name || member.full_name

                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 border-b border-home-border px-5 py-3 last:border-b-0"
                    >
                      <div className="w-5 shrink-0 text-sm font-bold text-primary">{i + 1}</div>
                      <LeaderboardMemberAvatar
                        name={displayName}
                        profileImageUrl={member.profile_image_url}
                        jtColor={member.jt_color ?? jiating.color}
                        size="md"
                      />
                      <div className="min-w-0 flex-1 truncate text-sm font-medium text-text">
                        {displayName}
                      </div>
                      <div className="shrink-0 text-sm font-bold text-text">
                        {member.total_points}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
