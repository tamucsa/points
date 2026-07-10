import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  Calendar,
  ClipboardList,
  Home,
  Medal,
  QrCode,
  Shield,
  Star,
  Trophy,
  User,
  Users,
} from 'lucide-react'

export const ICON_SIZES = {
  sm: 'size-3.5',
  md: 'size-4',
  nav: 'size-[1.125rem]',
} as const

export const SCOPE_ICONS: Record<string, LucideIcon> = {
  org: Building2,
  jt_shared: Medal,
  jt_specific: Home,
}

export const CHECKIN_TYPE_ICONS: Record<string, LucideIcon> = {
  officer: User,
  self: QrCode,
  rsvp_required: ClipboardList,
}

export const CHECKIN_METHOD_ICONS: Record<string, LucideIcon> = {
  officer: User,
  qr_scan: QrCode,
  self: QrCode,
}

export const NAV_ICONS = {
  leaderboard: Trophy,
  events: Calendar,
  profile: Star,
  members: Users,
  officerEvents: ClipboardList,
  admin: Shield,
} as const satisfies Record<string, LucideIcon>
