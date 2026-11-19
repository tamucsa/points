'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { pointsCutoffNotice } from '@/utils/points-cutoff'

const TABS = [
  { label: 'Overall', path: '/leaderboard', exact: true },
  { label: 'Jiatings', path: '/leaderboard/jiatings', exact: false },
  { label: 'Standings', path: '/leaderboard/standings', exact: false },
] as const

export default function LeaderboardTabs({
  pointsCutoffAt = null,
}: {
  pointsCutoffAt?: string | null
}) {
  const pathname = usePathname()
  const notice = pointsCutoffNotice(pointsCutoffAt)

  return (
    <>
      <div className={`${notice ? 'mb-4' : 'mb-6'} flex flex-wrap gap-2`}>
        {TABS.map(tab => {
          const active = tab.exact ? pathname === tab.path : pathname.startsWith(tab.path)
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                active
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'border border-home-border bg-surface text-subtitle hover:border-primary/30 hover:text-primary'
              }`}
            >
              {tab.label}
            </Link>
          )
        })}
      </div>
      {notice && (
        <p className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-text">
          {notice}
        </p>
      )}
    </>
  )
}
