'use server'

import { getCurrentMember } from '@/utils/supabase/auth'

export type ThemePreference = 'light' | 'dark' | 'system'

const VALID: ThemePreference[] = ['light', 'dark', 'system']

export async function updateThemePreference(theme: ThemePreference) {
  if (!VALID.includes(theme)) {
    return { success: false, error: 'Invalid theme preference.' }
  }

  const { supabase, user, member } = await getCurrentMember()
  if (!user || !member) {
    return { success: false, error: 'Not authenticated.' }
  }

  const { error } = await supabase
    .from('members')
    .update({ theme_preference: theme })
    .eq('id', member.id)

  if (error) {
    return { success: false, error: 'Failed to save theme preference.' }
  }

  // Avoid revalidatePath here — it remounted ThemeSync and fought the toggle.
  return { success: true, error: null }
}
