'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/semesters', label: 'Semesters' },
] as const

export default function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="mb-6 inline-flex rounded-2xl border border-home-border bg-surface p-1 shadow-sm">
      {LINKS.map(link => {
        const active = pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              active
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-subtitle hover:bg-bg hover:text-text'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
