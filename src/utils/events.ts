/** Officer-selectable event categories (stored in events.category). */
export const EVENT_CATEGORIES = [
  'General Meeting',
  'CSA-Wide',
  'Jiating Olympics',
  'Mixer',
  'Sports',
  'Philanthropy',
  'Dance',
  'Concessions',
] as const

export type EventCategory = (typeof EVENT_CATEGORIES)[number]

export type EventScope = 'org' | 'jt_shared' | 'jt_specific'
export type CheckInType = 'officer' | 'self' | 'rsvp_required'

export interface CategoryConfig {
  pointValue: 1 | 2 | 3
  scope: EventScope
  /** When set, check-in type is fixed for this category. */
  checkInType?: CheckInType
  /** Sports only: optional linked spectator QR event. */
  allowSpectators?: boolean
}

/**
 * Category drives point value, scope, and (for some categories) check-in type.
 * Adjust here if CSA rules change.
 */
export const CATEGORY_CONFIG: Record<EventCategory, CategoryConfig> = {
  'General Meeting': { pointValue: 2, scope: 'org', checkInType: 'self' },
  'CSA-Wide': { pointValue: 3, scope: 'org' },
  'Jiating Olympics': { pointValue: 2, scope: 'jt_shared', checkInType: 'officer' },
  'Mixer': { pointValue: 2, scope: 'jt_shared', checkInType: 'officer' },
  'Sports': { pointValue: 1, scope: 'org', checkInType: 'officer', allowSpectators: true },
  'Philanthropy': { pointValue: 3, scope: 'org' },
  'Dance': { pointValue: 1, scope: 'org', checkInType: 'officer' },
  'Concessions': { pointValue: 3, scope: 'org', checkInType: 'officer' },
}

/** Auto-created child event when Sports has spectator check-in enabled. */
export const SPECTATOR_EVENT_CATEGORY = 'Sports Spectator'

const SCOPE_LABELS: Record<EventScope, string> = {
  org: 'CSA-Wide',
  jt_shared: 'JT Shared',
  jt_specific: 'JT Specific',
}

const CHECKIN_LABELS: Record<CheckInType, string> = {
  officer: 'Officer check-in',
  self: 'QR / self check-in',
  rsvp_required: 'RSVP required',
}

export function getCategoryConfig(category: string): CategoryConfig | null {
  if ((EVENT_CATEGORIES as readonly string[]).includes(category)) {
    return CATEGORY_CONFIG[category as EventCategory]
  }
  return null
}

export function getCategoryScopeLabel(category: string) {
  const config = getCategoryConfig(category)
  return config ? SCOPE_LABELS[config.scope] : null
}

export function getCategoryCheckInLabel(category: string, checkInType: CheckInType) {
  const config = getCategoryConfig(category)
  const type = config?.checkInType ?? checkInType
  return CHECKIN_LABELS[type]
}

export function isGeneralMeetingCategory(category: string) {
  return category.trim() === 'General Meeting'
}

export function isSportsCategory(category: string) {
  return category.trim() === 'Sports'
}

export function isJiatingOlympicsCategory(category: string) {
  return category.trim() === 'Jiating Olympics'
}

export function isMixerCategory(category: string) {
  return category.trim() === 'Mixer'
}

export function isSportsRelatedCategory(category: string) {
  const value = category.trim()
  return value === 'Sports' || value === SPECTATOR_EVENT_CATEGORY || value === 'Dance'
}

export function applyCategoryDefaults(
  category: EventCategory,
  current: {
    scope: string
    check_in_type: string
    has_spectators: boolean
  },
) {
  const config = CATEGORY_CONFIG[category]
  return {
    category,
    point_value: String(config.pointValue),
    scope: config.scope,
    check_in_type: config.checkInType ?? current.check_in_type,
    has_spectators: config.allowSpectators ? current.has_spectators : false,
  }
}
