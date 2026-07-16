'use client'

import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import MemberAvatar from '@/app/components/MemberAvatar'
import IconLabel from '@/app/components/IconLabel'
import { NAV_ICONS } from '@/utils/icons'
import { createBrowserSupabase } from '@/utils/supabase/client'

interface Member {
  id: string
  full_name: string
  role: string
  profile_image_url: string | null
}

interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  officerOnly?: boolean
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Leaderboard', path: '/leaderboard', icon: NAV_ICONS.leaderboard },
  { label: 'Events', path: '/events', icon: NAV_ICONS.events },
  { label: 'My Points', path: '/profile', icon: NAV_ICONS.profile },
  { label: 'Members', path: '/officer/members', icon: NAV_ICONS.members, officerOnly: true },
  { label: 'Officer Events', path: '/officer/events', icon: NAV_ICONS.officerEvents, officerOnly: true },
  { label: 'Admin', path: '/admin/members', icon: NAV_ICONS.admin, adminOnly: true },
]

const EXPANDED_WIDTH = '16rem'
const COLLAPSED_WIDTH = '4.5rem'

export default function Sidebar({ member }: { member: Member }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileImageUrl, setProfileImageUrl] = useState(member.profile_image_url)
  const isOfficer = ['officer', 'admin'].includes(member.role)
  const isAdmin = member.role === 'admin'

  useEffect(() => {
    setProfileImageUrl(member.profile_image_url)
  }, [member.profile_image_url])

  // Layout props can be stale across client navigations; refresh from DB.
  useEffect(() => {
    const supabase = createBrowserSupabase()
    void supabase
      .from('members')
      .select('profile_image_url')
      .eq('id', member.id)
      .single()
      .then(({ data }) => {
        if (data?.profile_image_url) {
          setProfileImageUrl(data.profile_image_url)
        }
      })
  }, [member.id])

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  const generalNav = NAV_ITEMS.filter(item => !item.officerOnly && !item.adminOnly)
  const officerNav = NAV_ITEMS.filter(item => item.officerOnly)
  const adminNav = NAV_ITEMS.filter(item => item.adminOnly)

  const displayName = member.full_name

  const navLink = (item: NavItem) => {
    const active = pathname.startsWith(item.path)
    const Icon = item.icon
    return (
      <Link
        key={item.path}
        href={item.path}
        title={collapsed ? item.label : undefined}
        onClick={() => setMobileOpen(false)}
        className={`mb-1 flex items-center rounded-2xl text-sm font-medium transition ${
          collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-3 py-3'
        } ${active ? 'bg-primary/10 text-primary shadow-sm' : 'text-subtitle hover:bg-bg hover:text-text'}`}
      >
        {collapsed ? (
          <Icon className="size-[1.125rem] shrink-0" aria-hidden />
        ) : (
          <IconLabel
            icon={Icon}
            label={item.label}
            size="nav"
            iconClassName={active ? 'text-primary' : 'text-subtitle'}
            labelClassName={active ? 'text-primary' : ''}
          />
        )}
      </Link>
    )
  }

  const sidebarContent = (
    <>
      <div className={`flex items-center border-b border-home-border pb-5 ${collapsed ? 'justify-center px-2' : 'justify-between px-2'}`}>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-[1.15rem] font-bold tracking-[-0.04em] text-text">
              CSA Points
            </div>
            <div className="mt-1 text-xs text-subtitle">
              {isOfficer ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : 'Member'}
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden shrink-0 rounded-xl border border-home-border bg-white p-2 text-subtitle transition hover:border-primary/30 hover:text-primary lg:flex"
        >
          {collapsed ? <ChevronRight className="size-4" aria-hidden /> : <ChevronLeft className="size-4" aria-hidden />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {generalNav.map(navLink)}

        {isOfficer && (
          <>
            {!collapsed && (
              <div className="px-3 pt-5 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-subtitle">
                Officer
              </div>
            )}
            {collapsed && <div className="my-2 border-t border-home-border" />}
            {officerNav.map(navLink)}
          </>
        )}

        {isAdmin && (
          <>
            {!collapsed && (
              <div className="px-3 pt-5 pb-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-subtitle">
                Admin
              </div>
            )}
            {collapsed && <div className="my-2 border-t border-home-border" />}
            {adminNav.map(navLink)}
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-home-border pt-4">
        <div className={`rounded-3xl border border-home-border bg-bg shadow-sm ${collapsed ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <MemberAvatar
              name={displayName}
              profileImageUrl={profileImageUrl}
            />
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-text">{displayName}</div>
                <div className="text-xs text-subtitle">{member.role}</div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { window.location.href = '/api/auth/signout' }}
            className={`mt-3 flex w-full items-center justify-center rounded-xl border border-home-border bg-white text-sm text-subtitle transition hover:border-primary/30 hover:text-primary ${collapsed ? 'px-2 py-2' : 'gap-2 px-3 py-2'}`}
            title={collapsed ? 'Sign out' : undefined}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>
    </>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-home-border bg-white px-4 print:hidden lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-xl border border-home-border px-3 py-2 text-subtitle"
        >
          <Menu className="size-4" aria-hidden />
        </button>
        <span className="font-bold text-text">CSA Points</span>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-home-border bg-white px-3 py-5 shadow-[8px_0_40px_rgba(15,23,42,0.04)] transition-[width] duration-200 print:hidden lg:sticky lg:top-0 lg:z-auto lg:h-screen ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {sidebarContent}
      </aside>

    </>
  )
}
