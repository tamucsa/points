'use server'

import { createActionSupabase } from '@/utils/supabase/action'
import { createAdminSupabase } from '@/utils/supabase/admin'

async function requireAdmin() {
  const supabase = await createActionSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, adminMemberId: null, error: 'Not authenticated.' as const }

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

export async function closeActiveSemester() {
  const { error: authError } = await requireAdmin()
  if (authError) return { success: false, error: authError }

  const admin = createAdminSupabase()

  const { data: active } = await admin
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle()

  if (!active) {
    return { success: false, error: 'No active semester to close.' }
  }

  const { error } = await admin.rpc('close_semester', { p_semester_id: active.id })

  if (error) return { success: false, error: 'Failed to close semester.' }

  return { success: true, error: null, closedSemester: active.name }
}

export async function startSemester(input: {
  name: string
  startDate: string
  endDate: string
  yearId: string
}) {
  const { error: authError } = await requireAdmin()
  if (authError) return { success: false, error: authError }

  const name = input.name.trim()
  if (!name) return { success: false, error: 'Semester name is required.' }
  if (!input.startDate || !input.endDate) {
    return { success: false, error: 'Start and end dates are required.' }
  }
  if (!input.yearId) return { success: false, error: 'School year is required.' }

  const admin = createAdminSupabase()

  const { data: active } = await admin
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  if (active) {
    return { success: false, error: 'Close the current semester before starting a new one.' }
  }

  const { error } = await admin.from('semesters').insert({
    name,
    start_date: input.startDate,
    end_date: input.endDate,
    year_id: input.yearId,
    is_active: true,
  })

  if (error) return { success: false, error: 'Failed to create semester.' }

  return { success: true, error: null }
}

export async function listSemesters() {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { semesters: [], years: [], error: authError }

  const [{ data: semesters }, { data: years }] = await Promise.all([
    supabase
      .from('semesters')
      .select('id, name, start_date, end_date, is_active, year_id, years(label)')
      .order('start_date', { ascending: false }),
    supabase.from('years').select('id, label').order('label', { ascending: false }),
  ])

  return { semesters: semesters ?? [], years: years ?? [], error: null }
}
