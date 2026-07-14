'use server'

import {
  isMemberRole,
  validateClassYear,
  validateRegistrationNames,
  type MemberRole,
} from '@/utils/members'
import { createActionSupabase } from '@/utils/supabase/action'
import { createAdminSupabase } from '@/utils/supabase/admin'

export type ImportMode = 'full' | 'spring'

export interface JtChange {
  email: string
  fullName: string
  fromJt: string | null
  toJt: string
}

async function requireAdmin() {
  const supabase = await createActionSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { supabase, adminMemberId: null, error: 'Not authenticated.' as const }
  }

  const { data: member } = await supabase
    .from('members')
    .select('id, role')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!member || member.role !== 'admin') {
    return { supabase, adminMemberId: null, error: 'Admin access required.' as const }
  }

  return { supabase, adminMemberId: member.id, error: null }
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

export async function updateMemberRole(memberId: string, role: MemberRole) {
  if (!memberId) {
    return { success: false, error: 'Member is required.' }
  }

  if (!isMemberRole(role)) {
    return { success: false, error: 'Invalid role.' }
  }

  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { success: false, error: authError }

  const { data: target, error: loadError } = await supabase
    .from('members')
    .select('id, role, status')
    .eq('id', memberId)
    .maybeSingle()

  if (loadError || !target) {
    return { success: false, error: 'Member not found.' }
  }

  if (target.status !== 'active') {
    return { success: false, error: 'Only active members can have their role changed.' }
  }

  if (target.role === role) {
    return { success: true, error: null }
  }

  if (target.role === 'admin' && role !== 'admin') {
    const { count, error: countError } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .neq('id', memberId)

    if (countError) {
      return { success: false, error: 'Failed to verify admin count.' }
    }

    if ((count ?? 0) === 0) {
      return {
        success: false,
        error: 'Cannot demote the last admin. Promote another admin first.',
      }
    }
  }

  const { error } = await supabase
    .from('members')
    .update({ role })
    .eq('id', memberId)

  if (error) return { success: false, error: 'Failed to update role.' }
  return { success: true, error: null }
}

export interface ImportMemberRow {
  fullName: string
  email: string
  jtFamily: string
  phone: string
  classYear: string
}

function resolveJtName(
  jtFamilyId: string | null,
  jtIdToName: Map<string, string>,
): string | null {
  if (!jtFamilyId) return null
  return jtIdToName.get(jtFamilyId) ?? null
}

export async function importMembers(rows: ImportMemberRow[], mode: ImportMode = 'full') {
  const { supabase, adminMemberId, error: authError } = await requireAdmin()
  if (authError) {
    return {
      success: false as const,
      added: 0,
      updated: 0,
      unchanged: 0,
      jtChanged: 0,
      jtChanges: [] as JtChange[],
      errors: [authError],
    }
  }

  const admin = createAdminSupabase()
  const importBatchId = crypto.randomUUID()

  const [{ data: jtFamilies }, { data: activeSemester }] = await Promise.all([
    supabase.from('jt_families').select('id, name').eq('is_active', true),
    admin.from('semesters').select('id').eq('is_active', true).maybeSingle(),
  ])

  const jtIdByName = new Map(
    (jtFamilies ?? []).map(jt => [jt.name.trim().toLowerCase(), jt.id]),
  )
  const jtNameById = new Map(
    (jtFamilies ?? []).map(jt => [jt.id, jt.name]),
  )

  const summary = {
    added: 0,
    updated: 0,
    unchanged: 0,
    jtChanged: 0,
    jtChanges: [] as JtChange[],
    errors: [] as string[],
  }

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase()
    const fullName = row.fullName?.trim()
    const jtName = row.jtFamily?.trim()

    if (!fullName) {
      summary.errors.push(`${email || '(blank email)'} — full name is required`)
      continue
    }

    if (!email?.endsWith('@tamu.edu')) {
      summary.errors.push(`${email || '(blank)'} — not a @tamu.edu address`)
      continue
    }

    if (!jtName) {
      summary.errors.push(`${email} — Jiating is required`)
      continue
    }

    const jtFamilyId = jtIdByName.get(jtName.toLowerCase())
    if (!jtFamilyId) {
      summary.errors.push(`${email} — unknown Jiating "${jtName}"`)
      continue
    }

    const phone = row.phone?.trim()
    if (!phone) {
      summary.errors.push(`${email} — phone is required`)
      continue
    }

    const classResult = validateClassYear(row.classYear)
    if (!classResult.ok) {
      summary.errors.push(`${email} — ${classResult.error}`)
      continue
    }

    const { data: existing } = await supabase
      .from('members')
      .select('id, full_name, phone, graduation_year, jt_family_id, status')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      const patch: Record<string, string | number> = {}
      const jtChanged = existing.jt_family_id !== jtFamilyId

      if (jtChanged) patch.jt_family_id = jtFamilyId
      if (existing.full_name !== fullName) patch.full_name = fullName
      if (existing.phone !== phone) patch.phone = phone
      if (existing.graduation_year !== classResult.year) patch.graduation_year = classResult.year
      if (existing.status !== 'active') patch.status = 'active'

      if (Object.keys(patch).length === 0) {
        summary.unchanged++
        continue
      }

      const { error } = await supabase
        .from('members')
        .update(patch)
        .eq('id', existing.id)

      if (error) {
        summary.errors.push(`${email} — ${error.message}`)
        continue
      }

      summary.updated++

      const isJtTransfer =
        mode === 'spring' &&
        jtChanged &&
        existing.jt_family_id != null

      if (isJtTransfer) {
        const fromJt = resolveJtName(existing.jt_family_id, jtNameById)
        summary.jtChanged++
        summary.jtChanges.push({
          email,
          fullName: (patch.full_name as string) ?? existing.full_name,
          fromJt,
          toJt: jtName,
        })

        await admin.from('jt_transfer_log').insert({
          member_id: existing.id,
          from_jt_family_id: existing.jt_family_id,
          to_jt_family_id: jtFamilyId,
          semester_id: activeSemester?.id ?? null,
          import_batch_id: importBatchId,
          imported_by: adminMemberId,
        })
      }

      continue
    }

    const { error } = await admin.from('members').insert({
      email,
      full_name: fullName,
      phone,
      graduation_year: classResult.year,
      jt_family_id: jtFamilyId,
      status: 'active',
      role: 'member',
    })

    if (error) {
      summary.errors.push(`${email} — ${error.message}`)
    } else {
      summary.added++
    }
  }

  return { success: true as const, ...summary }
}

export async function registerMember(input: {
  firstName: string
  lastName: string
  classYear: number
  phone: string
}) {
  const supabase = await createActionSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const names = validateRegistrationNames(input.firstName, input.lastName)
  if (!names.ok) return { success: false, error: names.error }

  const { error } = await supabase.from('members').insert({
    auth_uid: user.id,
    email: user.email,
    full_name: names.fullName,
    graduation_year: input.classYear,
    phone: input.phone.trim() || null,
    profile_image_url: user.user_metadata.avatar_url,
    status: 'pending_jt',
    role: 'member',
  })

  if (error) return { success: false, error: 'Something went wrong. Please try again.' }
  return { success: true, error: null }
}
