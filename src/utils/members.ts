/**
 * Member name helpers.
 *
 * `members.full_name` is the only name column — first and last name from
 * self-registration are concatenated; admin CSV import maps "Full Name" directly.
 */

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

export function validateClassYear(
  value: string,
): { ok: true; year: number } | { ok: false; error: string } {
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, error: 'Class is required.' }

  const year = parseInt(trimmed, 10)
  const currentYear = new Date().getFullYear()
  if (Number.isNaN(year) || year < currentYear || year > currentYear + 6) {
    return { ok: false, error: 'Please enter a valid class year.' }
  }

  return { ok: true, year }
}
