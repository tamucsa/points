import type { SupabaseClient } from '@supabase/supabase-js'

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Case-insensitive member email → id lookup (chunks PostgREST `or` + `ilike`).
 */
export async function lookupMembersByEmail(
  supabase: SupabaseClient,
  emails: string[],
): Promise<{ memberByEmail: Map<string, string>; error: string | null }> {
  const memberByEmail = new Map<string, string>()

  for (let i = 0; i < emails.length; i += 50) {
    const chunk = emails.slice(i, i + 50)
    const orFilter = chunk
      .map(email => {
        const safe = email.replace(/\\/g, '\\\\').replace(/"/g, '')
        return `email.ilike."${safe}"`
      })
      .join(',')

    const { data: members, error } = await supabase
      .from('members')
      .select('id, email')
      .or(orFilter)

    if (error) {
      return { memberByEmail, error: 'Failed to look up members by email.' }
    }
    for (const m of members ?? []) {
      memberByEmail.set(normalizeEmail(m.email), m.id)
    }
  }

  return { memberByEmail, error: null }
}
