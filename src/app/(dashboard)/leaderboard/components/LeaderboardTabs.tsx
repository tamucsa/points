'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Overall', path: '/leaderboard' },
  { label: 'Jiatings', path: '/leaderboard/jiatings' },
] as const

export default function LeaderboardTabs() {
  const pathname = usePathname()

  return (
    <div className="mb-6 flex gap-2">
      {TABS.map(tab => {
        const active = pathname === tab.path
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'bg-primary text-white shadow-sm'
                : 'border border-home-border bg-white text-subtitle hover:border-primary/30 hover:text-primary'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
