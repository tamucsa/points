import type { LucideIcon } from 'lucide-react'
import {
  Building2,
  Calendar,
  ClipboardList,
  Dumbbell,
  Eye,
  HandHeart,
  Handshake,
  Home,
  Medal,
  Music2,
  Popcorn,
  QrCode,
  Shield,
  Sparkles,
  Star,
  Trophy,
  UserCheck,
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
  officer: UserCheck,
  self: QrCode,
  rsvp_required: ClipboardList,
}

export const CHECKIN_METHOD_ICONS: Record<string, LucideIcon> = {
  officer: UserCheck,
  qr_scan: QrCode,
  self: QrCode,
}

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'General Meeting': Users,
  'CSA-Wide': Sparkles,
  'Jiating Olympics': Trophy,
  'Jiating Event': Home,
  Mixer: Handshake,
  Sports: Dumbbell,
  Philanthropy: HandHeart,
  Dance: Music2,
  Concessions: Popcorn,
  'Sports Spectator': Eye,
}

export const NAV_ICONS = {
  leaderboard: Trophy,
  events: Calendar,
  profile: Star,
  members: Users,
  officerEvents: ClipboardList,
  admin: Shield,
} as const satisfies Record<string, LucideIcon>
