import type { LucideIcon } from 'lucide-react'
import {
  CHECKIN_METHOD_ICONS,
  CHECKIN_TYPE_ICONS,
  ICON_SIZES,
  SCOPE_ICONS,
} from '@/utils/icons'
import {
  CHECKIN_METHOD_LABELS,
  CHECKIN_TYPE_LABELS,
  SCOPE_LABELS,
} from '@/utils/constants'

type IconSize = keyof typeof ICON_SIZES

interface IconLabelProps {
  icon: LucideIcon
  label: string
  size?: IconSize
  className?: string
  iconClassName?: string
  labelClassName?: string
}

export default function IconLabel({
  icon: Icon,
  label,
  size = 'md',
  className = '',
  iconClassName = 'text-subtitle',
  labelClassName = '',
}: IconLabelProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 leading-none ${className}`}>
      <Icon className={`shrink-0 ${ICON_SIZES[size]} ${iconClassName}`} aria-hidden />
      <span className={labelClassName}>{label}</span>
    </span>
  )
}

interface BadgeProps {
  scope?: string
  checkInType?: string
  checkInMethod?: string
  className?: string
}

export function ScopeBadge({ scope, className = '' }: { scope: string; className?: string }) {
  const Icon = SCOPE_ICONS[scope]
  const label = SCOPE_LABELS[scope] ?? scope
  if (!Icon) return <span className={className}>{label}</span>
  return (
    <span className={`inline-flex items-center leading-none ${className}`}>
      <IconLabel icon={Icon} label={label} size="sm" />
    </span>
  )
}

export function CheckInTypeBadge({ checkInType, className = '' }: BadgeProps) {
  const Icon = CHECKIN_TYPE_ICONS[checkInType ?? '']
  const label = CHECKIN_TYPE_LABELS[checkInType ?? ''] ?? checkInType
  if (!Icon || !label) return null
  return (
    <span className={`inline-flex items-center leading-none ${className}`}>
      <IconLabel icon={Icon} label={label} size="sm" />
    </span>
  )
}

export function CheckInMethodBadge({ checkInMethod, className = '' }: BadgeProps) {
  const Icon = CHECKIN_METHOD_ICONS[checkInMethod ?? '']
  const label = CHECKIN_METHOD_LABELS[checkInMethod ?? ''] ?? checkInMethod
  if (!Icon || !label) return <span className={className}>{label}</span>
  return (
    <span className={`inline-flex items-center leading-none ${className}`}>
      <IconLabel icon={Icon} label={label} size="sm" />
    </span>
  )
}
