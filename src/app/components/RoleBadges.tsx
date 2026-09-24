import { memberRoleBadges, type MemberRoleBadge } from '@/utils/members'

interface RoleBadgesProps {
  role: string
  isParent?: boolean | null
  /** Roster cards hide the default Member label; Parent / Officer still show. */
  hideMember?: boolean
  /** Admin role management only — everyone else sees Admin as Officer. */
  revealAdmin?: boolean
  className?: string
}

function badgeClass(badge: MemberRoleBadge) {
  if (badge === 'Parent') {
    return 'rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary'
  }
  if (badge === 'Admin') {
    return 'rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-text'
  }
  return 'rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-subtitle'
}

export default function RoleBadges({
  role,
  isParent,
  hideMember = false,
  revealAdmin = false,
  className = '',
}: RoleBadgesProps) {
  const badges = memberRoleBadges(role, isParent, { revealAdmin }).filter(
    badge => !hideMember || badge !== 'Member',
  )
  if (badges.length === 0) return null

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className}`}>
      {badges.map(badge => (
        <span key={badge} className={badgeClass(badge)}>
          {badge}
        </span>
      ))}
    </span>
  )
}
