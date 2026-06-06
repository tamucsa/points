'use server'

import { createActionSupabase } from '@/utils/supabase/action'

async function requireAdmin() {
  const supabase = await createActionSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Not authenticated.' as const }

  const { data: member } = await supabase
    .from('members')
    .select('role')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!member || member.role !== 'admin') {
    return { supabase, error: 'Admin access required.' as const }
  }

  return { supabase, error: null }
}

export async function activateMember(memberId: string, jtFamilyId: string) {
  if (!memberId || !jtFamilyId) {
    return { success: false, error: 'JT family is required.' }
  }

  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { success: false, error: authError }

  const { error } = await supabase
    .from('members')
    .update({ jt_family_id: jtFamilyId, status: 'active' })
    .eq('id', memberId)

  if (error) return { success: false, error: 'Failed to activate member.' }
  return { success: true, error: null }
}

export interface ImportMemberRow {
  fullName: string
  preferredName: string
  email: string
  phone: string
  graduationYear: string
}

export async function importMembers(rows: ImportMemberRow[]) {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { success: false, added: 0, skipped: 0, errors: [authError] }

  const summary = { added: 0, skipped: 0, errors: [] as string[] }

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase()

    if (!email?.endsWith('@tamu.edu')) {
      summary.errors.push(`${email || '(blank)'} — not a @tamu.edu address`)
      continue
    }

    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      summary.skipped++
      continue
    }

    const { error } = await supabase.from('members').insert({
      email,
      full_name: row.fullName?.trim(),
      preferred_name: row.preferredName?.trim() || null,
      phone: row.phone?.trim() || null,
      graduation_year: parseInt(row.graduationYear) || null,
      status: 'pending_jt',
      role: 'member',
    })

    if (error) {
      summary.errors.push(`${email} — ${error.message}`)
    } else {
      summary.added++
    }
  }

  return { success: true, ...summary }
}

export async function registerMember(input: {
  preferredName: string
  graduationYear: number
  phone: string
}) {
  const supabase = await createActionSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const { error } = await supabase.from('members').insert({
    auth_uid: user.id,
    email: user.email,
    full_name: user.user_metadata.full_name,
    preferred_name: input.preferredName.trim(),
    graduation_year: input.graduationYear,
    phone: input.phone.trim() || null,
    profile_image_url: user.user_metadata.avatar_url,
    status: 'pending_jt',
    role: 'member',
  })

  if (error) return { success: false, error: 'Something went wrong. Please try again.' }
  return { success: true, error: null }
}
