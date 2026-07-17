/** Officer-selectable event categories (stored in events.category). */
export const EVENT_CATEGORIES = [
  'General Meeting',
  'CSA-Wide',
  'CSA-Wide Mixers',
  'Jiating Olympics',
  'Jiating Event',
  'Jiating Mixer',
  'Sports',
  'Philanthropy',
  'Dance',
  'Concessions',
] as const

export type EventCategory = (typeof EVENT_CATEGORIES)[number]

export type EventScope = 'org' | 'jt_shared' | 'jt_specific'
export type CheckInType =
  | 'officer'
  | 'self'
  | 'rsvp_required'
  | 'csv_import'
  | 'manual_points'

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
  'CSA-Wide Mixers': { pointValue: 3, scope: 'org', checkInType: 'csv_import' },
  'Jiating Olympics': { pointValue: 2, scope: 'jt_shared', checkInType: 'officer' },
  'Jiating Event': { pointValue: 1, scope: 'jt_specific' },
  'Jiating Mixer': { pointValue: 2, scope: 'jt_shared' },
  'Sports': { pointValue: 1, scope: 'org', checkInType: 'officer', allowSpectators: true },
  'Philanthropy': { pointValue: 3, scope: 'org' },
  'Dance': { pointValue: 1, scope: 'org', checkInType: 'officer' },
  'Concessions': { pointValue: 3, scope: 'org', checkInType: 'officer' },
}

/**
 * Soft guidance for who typically creates each category.
 * Not enforced in RBAC — guidance only.
 */
export const CATEGORY_OWNER_HINTS: Record<EventCategory, string> = {
  'General Meeting': 'Typically created by Executives, mainly the Secretary',
  'CSA-Wide': 'Typically created by the Event Coordinator',
  'CSA-Wide Mixers': 'Typically created by the Event Coordinator',
  'Jiating Olympics': 'Typically created by the Sports chair',
  'Jiating Event': 'Typically created by Jiating parents for their own family',
  'Jiating Mixer': 'Typically created by Jiating parents',
  Sports: 'Typically created by the Sports chair',
  Philanthropy: 'Typically created by the Philanthropy chair',
  Dance: 'Typically created by the Dance chair',
  Concessions: 'Typically created by the Fundraising chair',
}

export function getCategoryOwnerHint(category: string): string | null {
  if ((EVENT_CATEGORIES as readonly string[]).includes(category)) {
    return CATEGORY_OWNER_HINTS[category as EventCategory]
  }
  return null
}

/** Auto-created child event when Sports has spectator check-in enabled. */
export const SPECTATOR_EVENT_CATEGORY = 'Sports Spectator'

const SCOPE_LABELS: Record<EventScope, string> = {
  org: 'CSA-Wide',
  jt_shared: 'JT Shared',
  jt_specific: 'JT Specific',
}

const CHECKIN_LABELS: Record<CheckInType, string> = {
  officer: 'Officer Check-in',
  self: 'Self Check-in',
  rsvp_required: 'RSVP',
  csv_import: 'CSV Check-in',
  manual_points: 'Manual Points',
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
  const value = category.trim()
  // 'Mixer' kept for any legacy rows created before the rename.
  return value === 'Jiating Mixer' || value === 'Mixer'
}

export function isCsaWideMixersCategory(category: string) {
  return category.trim() === 'CSA-Wide Mixers'
}

export function isCsvImportCheckIn(checkInType: string) {
  return checkInType === 'csv_import'
}

export function isManualPointsCheckIn(checkInType: string) {
  return checkInType === 'manual_points'
}

/** Badge label for event cards — manual points are variable per member. */
export function formatEventPointsLabel(
  pointValue: number,
  checkInType: string,
): string {
  if (isManualPointsCheckIn(checkInType)) return 'Var'
  return String(pointValue)
}

/** Stored as midnight–23:59 Central so sorting/caps still work without a real clock time. */
export const MANUAL_POINTS_DEFAULT_START_TIME = '00:00'
export const MANUAL_POINTS_DEFAULT_END_TIME = '23:59'

/** Check-in types that award points via officer CSV upload (no QR / roster). */
export function isImportCheckIn(checkInType: string) {
  return isCsvImportCheckIn(checkInType) || isManualPointsCheckIn(checkInType)
}

/** Philanthropy may use officer / self / RSVP / manual_points. */
export function isPhilanthropyCategory(category: string) {
  return category.trim() === 'Philanthropy'
}

export function isSportsRelatedCategory(category: string) {
  const value = category.trim()
  return value === 'Sports' || value === SPECTATOR_EVENT_CATEGORY || value === 'Dance'
}

/** Browse filters for officer + member event lists (not RBAC). */
export const EVENT_FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'csa', label: 'CSA' },
  { id: 'jiating', label: 'Jiating' },
  { id: 'sports', label: 'Sports' },
  { id: 'dance', label: 'Dance' },
] as const

export type EventFilterTabId = (typeof EVENT_FILTER_TABS)[number]['id']

export function isDanceCategory(category: string) {
  return category.trim() === 'Dance'
}

export function eventMatchesFilter(
  event: { category: string; scope: string },
  filter: EventFilterTabId,
): boolean {
  if (filter === 'all') return true

  const category = event.category.trim()

  if (filter === 'dance') {
    return isDanceCategory(category)
  }

  if (filter === 'sports') {
    return category === 'Sports' || category === SPECTATOR_EVENT_CATEGORY
  }

  if (filter === 'jiating') {
    return (
      event.scope === 'jt_specific' ||
      isJiatingOlympicsCategory(category) ||
      isMixerCategory(category)
    )
  }

  // CSA: org-wide programming excluding sports/dance
  return (
    event.scope === 'org' &&
    category !== 'Sports' &&
    category !== SPECTATOR_EVENT_CATEGORY &&
    !isDanceCategory(category)
  )
}

/**
 * Officer Jiating family filter: which family an event counts toward.
 * - Olympics: every selected family
 * - Mixer: only participating families (legacy mixers with no links → all)
 * - JT-specific: that event's family only
 * `familyId === null` means All families.
 */
export function eventMatchesJiatingFamily(
  event: {
    id: string
    category: string
    scope: string
    jt_family_id: string | null
  },
  familyId: string | null,
  mixerFamiliesByEventId: Record<string, string[]>,
): boolean {
  if (!familyId) return true

  if (isJiatingOlympicsCategory(event.category)) return true

  if (isMixerCategory(event.category)) {
    const ids = mixerFamiliesByEventId[event.id]
    if (!ids || ids.length === 0) return true
    return ids.includes(familyId)
  }

  if (event.scope === 'jt_specific') {
    return event.jt_family_id === familyId
  }

  return false
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
