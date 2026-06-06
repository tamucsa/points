'use client'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

interface Member {
  id: string
  preferred_name: string | null
  full_name: string
  role: string
  profile_image_url: string | null
}

interface NavItem {
  label: string
  path: string
  emoji: string
  officerOnly?: boolean
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Leaderboard',     path: '/leaderboard',        emoji: '🏆' },
  { label: 'Events',          path: '/events',             emoji: '📅' },
  { label: 'My Points',       path: '/profile',            emoji: '⭐' },
  { label: 'Members',         path: '/officer/members',    emoji: '👥', officerOnly: true },
  { label: 'Officer Events',  path: '/officer/events',     emoji: '📋', officerOnly: true },
  // { label: 'Semester',        path: '/officer/semester',   emoji: '📊', officerOnly: true },
  { label: 'Admin',           path: '/admin/members',      emoji: '🔐', adminOnly: true },
]

export default function Sidebar({ member }: { member: Member }) {
  const pathname = usePathname()
  const router = useRouter()
  const isOfficer = ['officer', 'admin'].includes(member.role)
  const isAdmin = member.role === 'admin'

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const generalNav = NAV_ITEMS.filter(item => !item.officerOnly && !item.adminOnly)
  const officerNav = NAV_ITEMS.filter(item => item.officerOnly)
  const adminNav = NAV_ITEMS.filter(item => item.adminOnly)

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-home-border bg-white px-4 py-6 shadow-[8px_0_40px_rgba(15,23,42,0.04)]">
      {/* Logo */}
      <div className="px-2 pb-6">
        <div className="text-[1.15rem] font-bold tracking-[-0.04em] text-text">
          CSA Points
        </div>
        <div className="mt-1 text-xs text-subtitle">
          {isOfficer ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : 'Member'}
        </div>
      </div>

      {/* Top-level Nav items */}
      {generalNav.map(item => {
        const active = pathname.startsWith(item.path)
        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            className={`mb-1 flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${active ? 'bg-primary/10 text-primary shadow-sm' : 'text-subtitle hover:bg-bg hover:text-text'}`}
          >
            <span className="text-base">{item.emoji}</span>
            <span>{item.label}</span>
          </button>
        )
      })}

      {/* Officer section */}
      {isOfficer && (
        <>
          <div className="px-3 pt-5 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-subtitle">
            Officer
          </div>
          {officerNav.map(item => {
            const active = pathname.startsWith(item.path)
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`mb-1 flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${active ? 'bg-primary/10 text-primary shadow-sm' : 'text-subtitle hover:bg-bg hover:text-text'}`}
              >
                <span className="text-base">{item.emoji}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </>
      )}

      {/* Admin section */}
      {isAdmin && (
        <>
          <div className="px-3 pt-5 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-subtitle">
            Admin
          </div>
          {adminNav.map(item => {
            const active = pathname.startsWith(item.path)
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`mb-1 flex items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium transition ${active ? 'bg-primary/10 text-primary shadow-sm' : 'text-subtitle hover:bg-bg hover:text-text'}`}
              >
                <span className="text-base">{item.emoji}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </>
      )}

      {/* User info + sign out */}
      <div className="mt-auto pt-6">
        <div className="rounded-3xl border border-home-border bg-bg p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            {member.profile_image_url ? (
              <img
                src={member.profile_image_url}
                className="h-8 w-8 rounded-full border border-home-border object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
                {(member.preferred_name || member.full_name)[0]}
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-text">
                {member.preferred_name || member.full_name}
              </div>
              <div className="text-xs text-subtitle">{member.role}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="w-full rounded-xl border border-home-border bg-white px-3 py-2 text-sm text-subtitle transition hover:border-primary/30 hover:text-primary"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}