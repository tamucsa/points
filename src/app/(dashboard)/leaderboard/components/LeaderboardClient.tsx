'use client'
import { useState } from 'react'

interface Member {
  id: string
  full_name: string
  preferred_name: string
  email: string
  profile_image_url: string
  jt_family: string
  jt_color: string
  total_points: number
  csa_points: number
  jt_points: number
  sports_points: number
  gm_points: number
}

interface JTTotal {
  jt_family: string
  jt_color: string
  member_count: number
  total_points: number
  avg_points_per_member: number
}

interface Semester {
  name: string
}

interface Props {
  members: Member[]
  jtTotals: JTTotal[]
  semester: Semester | null
}

const TABS = ['Overall', 'By JT']

export default function LeaderboardClient({ members, jtTotals, semester }: Props) {
  const [tab, setTab] = useState('Overall')
  const maxPts = members[0]?.total_points ?? 1

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-8">

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text">Leaderboard</h1>
          <div className="mt-1 text-sm text-subtitle">
            {semester?.name ?? 'Current Semester'} · {members.length} members
          </div>
        </div>
        <div className="inline-flex rounded-2xl border border-home-border bg-white p-1 shadow-sm">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${tab === t ? 'bg-primary text-white shadow-sm' : 'text-subtitle hover:bg-bg hover:text-text'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Overall tab */}
      {tab === 'Overall' && (
        <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          {/* Column headers */}
          <div className="grid grid-cols-[40px_1fr_70px_70px_70px_100px] border-b border-home-border bg-bg px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtitle">
            <div>#</div>
            <div>Member</div>
            <div className="text-right">Total</div>
            <div className="text-right">CSA</div>
            <div className="text-right">JT</div>
            <div className="pl-3">Progress</div>
          </div>

          {members.length === 0 && (
            <div className="px-10 py-12 text-center text-sm text-subtitle">
              No active members yet.
            </div>
          )}

          {members.map((m, i) => (
            <div
              key={m.id}
              className="grid grid-cols-[40px_1fr_70px_70px_70px_100px] items-center border-b border-home-border px-5 py-4 last:border-b-0"
            >
              {/* Rank */}
              <div className="text-sm font-bold text-primary">
                {i + 1}
              </div>

              {/* Member info */}
              <div className="flex items-center gap-3">
                {m.profile_image_url ? (
                  <img
                    src={m.profile_image_url}
                    alt={m.preferred_name}
                    className="h-8 w-8 shrink-0 rounded-full border border-home-border object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {m.preferred_name?.[0] ?? m.full_name?.[0]}
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-text">
                    {m.preferred_name || m.full_name}
                  </div>
                  {m.jt_family && (
                    <span className="mt-1 inline-block rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                      {m.jt_family}
                    </span>
                  )}
                </div>
              </div>

              {/* Points */}
              <div className="text-right text-sm font-bold text-text">
                {m.total_points}
              </div>
              <div className="text-right text-sm text-subtitle">
                {m.csa_points}
              </div>
              <div className="text-right text-sm text-subtitle">
                {m.jt_points}
              </div>

              {/* Progress bar */}
              <div className="pl-3">
                <div className="h-2 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(m.total_points / maxPts) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* By JT tab */}
      {tab === 'By JT' && (
        <div className="grid gap-4 md:grid-cols-2">
          {jtTotals.length === 0 && (
            <div className="rounded-3xl border border-home-border bg-white px-10 py-12 text-center text-sm text-subtitle md:col-span-2">
              No JT data yet.
            </div>
          )}
          {[...jtTotals].sort((a, b) => b.total_points - a.total_points).map((jt, i) => (
            <div
              key={jt.jt_family}
              className="rounded-4xl border border-home-border bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                  <span className="text-base font-bold text-text">{jt.jt_family}</span>
                  {i === 0 && <span className="text-sm">👑</span>}
                </div>
                <div className="text-xs text-subtitle">{jt.member_count} members</div>
              </div>
              <div className="text-4xl font-extrabold tracking-[-1px] text-primary">
                {jt.total_points}
              </div>
              <div className="mt-1 text-xs text-subtitle">total points</div>
              <div className="mt-1 text-xs text-subtitle/80">
                {jt.avg_points_per_member} avg per member
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-bg">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(jt.total_points / (jtTotals[0]?.total_points || 1)) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}