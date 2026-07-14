'use server'

import { createActionSupabase } from '@/utils/supabase/action'
import { createAdminSupabase } from '@/utils/supabase/admin'
import { fetchAllPages } from '@/utils/supabase/fetchAll'

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

export interface SemesterJtFamily {
  name: string
  color: string | null
}

export interface SemesterListItem {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  year_id: string
  years: { name: string } | { name: string }[] | null
  jtFamilies: SemesterJtFamily[]
  eventCount: number
  memberCount: number
}

export async function listSemesters() {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { semesters: [] as SemesterListItem[], years: [], error: authError }

  const [
    { data: semesters, error: semestersError },
    { data: years, error: yearsError },
    { data: jtFamilies, error: jtError },
    { data: events, error: eventsError },
    { data: summaries, error: summariesError },
  ] = await Promise.all([
    supabase
      .from('semesters')
      .select('id, name, start_date, end_date, is_active, year_id, years(name)')
      .order('start_date', { ascending: false }),
    supabase.from('years').select('id, name').order('name', { ascending: false }),
    fetchAllPages<{ name: string; color: string | null; semester: string | null; is_active: boolean }>(
      (from, to) =>
        supabase
          .from('jt_families')
          .select('name, color, semester, is_active')
          .order('name')
          .range(from, to),
    ),
    fetchAllPages<{ semester_id: string }>((from, to) =>
      supabase.from('events').select('semester_id').range(from, to),
    ),
    fetchAllPages<{ semester_id: string; jt_family_name: string | null }>((from, to) =>
      supabase.from('semester_summaries').select('semester_id, jt_family_name').range(from, to),
    ),
  ])

  if (semestersError || yearsError || jtError || eventsError || summariesError) {
    return { semesters: [] as SemesterListItem[], years: [], error: 'Failed to load semesters.' }
  }

  const eventCounts = new Map<string, number>()
  for (const event of events) {
    eventCounts.set(event.semester_id, (eventCounts.get(event.semester_id) ?? 0) + 1)
  }

  const memberCounts = new Map<string, number>()
  const summaryJtNames = new Map<string, Set<string>>()
  for (const summary of summaries) {
    memberCounts.set(summary.semester_id, (memberCounts.get(summary.semester_id) ?? 0) + 1)
    if (summary.jt_family_name) {
      const names = summaryJtNames.get(summary.semester_id) ?? new Set<string>()
      names.add(summary.jt_family_name)
      summaryJtNames.set(summary.semester_id, names)
    }
  }

  const jtsBySemester = new Map<string, SemesterJtFamily[]>()
  const activeJtFamilies: SemesterJtFamily[] = []
  for (const jt of jtFamilies) {
    if (jt.is_active) {
      activeJtFamilies.push({ name: jt.name, color: jt.color })
    }
    if (jt.semester) {
      const list = jtsBySemester.get(jt.semester) ?? []
      list.push({ name: jt.name, color: jt.color })
      jtsBySemester.set(jt.semester, list)
    }
  }

  const enriched: SemesterListItem[] = (semesters ?? []).map(semester => {
    const linkedJts = jtsBySemester.get(semester.id) ?? []
    const archivedJtNames = summaryJtNames.get(semester.id)
    const archivedJts = archivedJtNames
      ? [...archivedJtNames].sort().map(name => ({ name, color: null }))
      : []

    let jtFamiliesForSemester = linkedJts
    if (jtFamiliesForSemester.length === 0 && semester.is_active) {
      jtFamiliesForSemester = activeJtFamilies
    } else if (jtFamiliesForSemester.length === 0) {
      jtFamiliesForSemester = archivedJts
    }

    return {
      ...semester,
      jtFamilies: jtFamiliesForSemester,
      eventCount: eventCounts.get(semester.id) ?? 0,
      memberCount: memberCounts.get(semester.id) ?? 0,
    }
  })

  return { semesters: enriched, years: years ?? [], error: null }
}
