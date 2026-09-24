/**
 * Member name helpers.
 *
 * `members.full_name` is the only name column — first and last name from
 * self-registration are concatenated; admin CSV import maps "Full Name" directly.
 */

export type MemberRole = 'member' | 'officer' | 'admin'

export const MEMBER_ROLES: MemberRole[] = ['member', 'officer', 'admin']

/** First-class access assignments shown in admin role management. */
export const ACCESS_PRESETS = [
  'member',
  'parent',
  'officer',
  'officer_parent',
  'admin',
  'admin_parent',
] as const

export type AccessPreset = (typeof ACCESS_PRESETS)[number]

export const ACCESS_PRESET_LABELS: Record<AccessPreset, string> = {
  member: 'Member',
  parent: 'Parent',
  officer: 'Officer',
  officer_parent: 'Officer + Parent',
  admin: 'Admin',
  admin_parent: 'Admin + Parent',
}

export type MemberRoleBadge = 'Member' | 'Parent' | 'Officer' | 'Admin'

export type MemberAccess = {
  role: string
  is_parent?: boolean | null
}

export function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(value)
}

export function isOfficerRole(role: string): boolean {
  return role === 'officer' || role === 'admin'
}

export function isParent(member: MemberAccess): boolean {
  return member.is_parent === true || member.role === 'parent'
}

/** Parent without officer/admin — limited to their Jiating Event / Mixer. */
export function isParentOnly(member: MemberAccess): boolean {
  return isParent(member) && !isOfficerRole(member.role)
}

export function canAccessOfficerMembers(member: MemberAccess): boolean {
  return isOfficerRole(member.role) || isParent(member)
}

export function canAccessOfficerEvents(member: MemberAccess): boolean {
  return isOfficerRole(member.role) || isParent(member)
}

export function memberRoleBadges(
  role: string,
  isParentFlag?: boolean | null,
  options?: { revealAdmin?: boolean },
): MemberRoleBadge[] {
  const parent = isParentFlag === true || role === 'parent'
  const staff: MemberRoleBadge | null = isOfficerRole(role)
    ? role === 'admin' && options?.revealAdmin
      ? 'Admin'
      : 'Officer'
    : null
  if (staff && parent) return [staff, 'Parent']
  if (parent) return ['Parent']
  if (staff) return [staff]
  return ['Member']
}

export type MemberAccessLabel =
  | 'Member'
  | 'Parent'
  | 'Officer'
  | 'Admin'
  | 'Officer · Parent'
  | 'Admin · Parent'

export function memberRoleLabel(
  role: string,
  isParentFlag?: boolean | null,
  options?: { revealAdmin?: boolean },
): MemberAccessLabel {
  return memberRoleBadges(role, isParentFlag, options).join(' · ') as MemberAccessLabel
}

export function accessPresetFromMember(
  role: string,
  isParentFlag?: boolean | null,
): AccessPreset {
  const parent = isParentFlag === true || role === 'parent'
  if (role === 'admin') return parent ? 'admin_parent' : 'admin'
  if (role === 'officer') return parent ? 'officer_parent' : 'officer'
  return parent ? 'parent' : 'member'
}

export function accessPresetToFields(preset: AccessPreset): {
  role: MemberRole
  is_parent: boolean
} {
  switch (preset) {
    case 'parent':
      return { role: 'member', is_parent: true }
    case 'officer':
      return { role: 'officer', is_parent: false }
    case 'officer_parent':
      return { role: 'officer', is_parent: true }
    case 'admin':
      return { role: 'admin', is_parent: false }
    case 'admin_parent':
      return { role: 'admin', is_parent: true }
    default:
      return { role: 'member', is_parent: false }
  }
}

/** Leaderboard / attendance points. Parents check in but never earn points. */
export function earnsPoints(member: MemberAccess): boolean {
  return !isParent(member)
}

export function roleEarnsPoints(role: string, isParentFlag?: boolean | null): boolean {
  return earnsPoints({ role, is_parent: isParentFlag })
}

/** Battle Pass and reduced-fee rewards — dues members only, not parents or officers. */
export function earnsRewards(member: MemberAccess): boolean {
  return member.role === 'member' && !isParent(member)
}

export function roleEarnsRewards(role: string, isParentFlag?: boolean | null): boolean {
  return earnsRewards({ role, is_parent: isParentFlag })
}

export function attendanceAwardsPoints(
  member: MemberAccess,
  counted: boolean,
): boolean {
  return earnsPoints(member) && counted
}

export const GRADUATE_STUDENT_CLASSIFICATION = 'Graduate Student'

const GRADUATE_STUDENT_ALIASES = new Set([
  'graduate student',
  'graduate',
  'grad student',
  'grad',
])

export function classificationOptions(): string[] {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 6 }, (_, i) => String(currentYear + i))
  return [...years, GRADUATE_STUDENT_CLASSIFICATION]
}

export function formatClassification(
  value: string | number | null | undefined,
): string | null {
  if (value == null || value === '') return null
  const text = String(value)
  if (text === GRADUATE_STUDENT_CLASSIFICATION) return GRADUATE_STUDENT_CLASSIFICATION
  if (/^\d{4}$/.test(text)) return `Class of ${text}`
  return text
}

export function parseGoogleName(metadata: {
  full_name?: string
  given_name?: string
  family_name?: string
}): { firstName: string; lastName: string } {
  const given = metadata.given_name?.trim()
  const family = metadata.family_name?.trim()

  if (given) {
    return { firstName: given, lastName: family ?? '' }
  }

  const full = metadata.full_name?.trim() ?? ''
  const space = full.indexOf(' ')
  if (space === -1) return { firstName: full, lastName: '' }

  return {
    firstName: full.slice(0, space),
    lastName: full.slice(space + 1).trim(),
  }
}

const MAX_NAME_LENGTH = 100

export function validateRegistrationNames(
  firstName: string,
  lastName: string,
): { ok: true; fullName: string } | { ok: false; error: string } {
  const trimmedFirst = firstName.trim()
  const trimmedLast = lastName.trim()

  if (!trimmedFirst) return { ok: false, error: 'First name is required.' }
  if (!trimmedLast) return { ok: false, error: 'Last name is required.' }
  if (trimmedFirst.length > MAX_NAME_LENGTH || trimmedLast.length > MAX_NAME_LENGTH) {
    return { ok: false, error: 'Name is too long.' }
  }

  return {
    ok: true,
    fullName: `${trimmedFirst} ${trimmedLast}`,
  }
}

export function validateClassification(
  value: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, error: 'Classification is required.' }

  if (GRADUATE_STUDENT_ALIASES.has(trimmed.toLowerCase())) {
    return { ok: true, value: GRADUATE_STUDENT_CLASSIFICATION }
  }

  if (!/^\d{4}$/.test(trimmed)) {
    return { ok: false, error: 'Please enter a valid classification.' }
  }

  const year = Number.parseInt(trimmed, 10)
  const currentYear = new Date().getFullYear()
  if (year < currentYear || year > currentYear + 6) {
    return { ok: false, error: 'Please enter a valid classification.' }
  }

  return { ok: true, value: trimmed }
}
