'use client'

import Link from 'next/link'

type MembersTab = 'members' | 'guests'

export function MembersTabs({ active }: { active: MembersTab }) {
  const tabs: { id: MembersTab; label: string; href: string }[] = [
    { id: 'members', label: 'Members', href: '/officer/members' },
    { id: 'guests', label: 'Guests', href: '/officer/members?tab=guests' },
  ]

  return (
    <div className="mb-5 inline-flex rounded-2xl border border-home-border bg-bg p-1">
      {tabs.map(tab => {
        const isActive = tab.id === active
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? 'bg-surface text-primary shadow-sm'
                : 'text-subtitle hover:text-text'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
