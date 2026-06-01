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
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Leaderboard', path: '/leaderboard', emoji: '🏆' },
  { label: 'Events',      path: '/events',      emoji: '📅' },
  { label: 'My Points',   path: '/profile',     emoji: '⭐' },
  { label: 'Members',     path: '/officer/members',   emoji: '👥', officerOnly: true },
  { label: 'Dashboard',   path: '/officer/dashboard', emoji: '🎖️', officerOnly: true },
  { label: 'Semester',    path: '/officer/semester',  emoji: '📊', officerOnly: true },
]

export default function Sidebar({ member }: { member: Member }) {
  const pathname = usePathname()
  const router = useRouter()
  const isOfficer = ['officer', 'admin'].includes(member.role)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleNav = NAV_ITEMS.filter(item => !item.officerOnly || isOfficer)

  return (
    <div style={{
      width: 220,
      background: '#0c0f1a',
      borderRight: '1px solid #1a1e2e',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 12px',
      gap: 4,
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '8px 12px 24px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
          CSA Points
        </div>
        <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
          {isOfficer ? member.role.charAt(0).toUpperCase() + member.role.slice(1) : 'Member'}
        </div>
      </div>

      {/* Nav items */}
      {visibleNav.map(item => {
        const active = pathname.startsWith(item.path)
        return (
          <button
            key={item.path}
            onClick={() => router.push(item.path)}
            style={{
              background: active ? '#1e2130' : 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px 12px',
              borderRadius: 8,
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 500,
              color: active ? '#fff' : '#666',
              textAlign: 'left',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>{item.emoji}</span>
            <span>{item.label}</span>
          </button>
        )
      })}

      {/* Officer section divider */}
      {isOfficer && (
        <div style={{
          fontSize: 11,
          color: '#333',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          padding: '16px 12px 4px',
        }}>
          Officer Tools
        </div>
      )}

      {/* User info + sign out */}
      <div style={{ marginTop: 'auto' }}>
        <div style={{
          padding: 12,
          background: '#161a27',
          borderRadius: 10,
          border: '1px solid #1e2337',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            {member.profile_image_url ? (
              <img
                src={member.profile_image_url}
                style={{ width: 32, height: 32, borderRadius: '50%' }}
              />
            ) : (
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#4f6ef720',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#4f6ef7',
              }}>
                {(member.preferred_name || member.full_name)[0]}
              </div>
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#ccc' }}>
                {member.preferred_name || member.full_name}
              </div>
              <div style={{ fontSize: 11, color: '#555' }}>{member.role}</div>
            </div>
          </div>
          <button
            onClick={signOut}
            style={{
              width: '100%',
              padding: '6px 0',
              background: 'transparent',
              border: '1px solid #2a2f45',
              borderRadius: 6,
              color: '#555',
              fontSize: 12,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}