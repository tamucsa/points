'use server'

import { createActionSupabase } from '@/utils/supabase/action'
import { createAdminSupabase } from '@/utils/supabase/admin'
import { fetchAllPages } from '@/utils/supabase/fetchAll'
import { schoolYearFromStartDate } from '@/utils/schoolYear'

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

const PLACEHOLDER_COUNT = 6

function randomJtColor(): string {
  const hue = Math.floor(Math.random() * 360)
  const sat = 45 + Math.floor(Math.random() * 25)
  const light = 40 + Math.floor(Math.random() * 15)
  return hslToHex(hue, sat, light)
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100
  const lN = l / 100
  const c = (1 - Math.abs(2 * lN - 1)) * sN
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lN - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export type JtInput = { name: string; color: string }

function defaultPlaceholders(): JtInput[] {
  return Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => ({
    name: `JT ${i + 1}`,
    color: randomJtColor(),
  }))
}

function normalizeJtInputs(jts: JtInput[] | undefined): JtInput[] | { error: string } {
  if (!jts || jts.length === 0) return defaultPlaceholders()

  const normalized: JtInput[] = []
  const seen = new Set<string>()
  for (const jt of jts) {
    const name = jt.name.trim()
    const color = jt.color.trim() || randomJtColor()
    if (!name) return { error: 'Jiating name is required.' }
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return { error: `Invalid color for "${name}". Use a hex color like #4f6ef7.` }
    }
    const key = name.toLowerCase()
    if (seen.has(key)) return { error: `Duplicate Jiating name "${name}".` }
    seen.add(key)
    normalized.push({ name, color })
  }
  return normalized
}

async function ensureYearId(
  admin: ReturnType<typeof createAdminSupabase>,
  startDate: string,
): Promise<{ yearId: string; yearName: string } | { error: string }> {
  const yearName = schoolYearFromStartDate(startDate)
  if (!yearName) return { error: 'Invalid start date.' }

  const { data: existing } = await admin
    .from('years')
    .select('id, name')
    .eq('name', yearName)
    .maybeSingle()

  if (existing) return { yearId: existing.id, yearName: existing.name }

  const { data: created, error } = await admin
    .from('years')
    .insert({ name: yearName })
    .select('id, name')
    .single()

  if (error || !created) return { error: 'Failed to create school year.' }
  return { yearId: created.id, yearName: created.name }
}

async function deactivateActiveJtFamilies(admin: ReturnType<typeof createAdminSupabase>) {
  const { error } = await admin
    .from('jt_families')
    .update({ is_active: false })
    .eq('is_active', true)
  return error
}

async function insertJtFamiliesForYear(
  admin: ReturnType<typeof createAdminSupabase>,
  yearId: string,
  semesterId: string | null,
  jts: JtInput[],
) {
  const rows = jts.map(jt => ({
    name: jt.name,
    color: jt.color,
    year_id: yearId,
    semester: semesterId,
    is_active: true,
  }))
  return admin.from('jt_families').insert(rows).select('id, name, color, year_id, is_active')
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
  /** Omit or empty = JT 1–6 placeholders. Custom list only when year has no JTs yet. */
  jiatings?: JtInput[]
}) {
  const { error: authError } = await requireAdmin()
  if (authError) return { success: false, error: authError }

  const name = input.name.trim()
  if (!name) return { success: false, error: 'Semester name is required.' }
  if (!input.startDate || !input.endDate) {
    return { success: false, error: 'Start and end dates are required.' }
  }
  if (input.startDate > input.endDate) {
    return { success: false, error: 'End date must be on or after start date.' }
  }

  const admin = createAdminSupabase()

  const { data: active } = await admin
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  if (active) {
    return { success: false, error: 'Close the current semester before starting a new one.' }
  }

  const yearResult = await ensureYearId(admin, input.startDate)
  if ('error' in yearResult) return { success: false, error: yearResult.error }

  const { data: existingYearJts } = await admin
    .from('jt_families')
    .select('id')
    .eq('year_id', yearResult.yearId)
    .eq('is_active', true)
    .limit(1)

  const yearHasJts = (existingYearJts?.length ?? 0) > 0

  let jtsToCreate: JtInput[] | null = null
  if (!yearHasJts) {
    const normalized = normalizeJtInputs(input.jiatings)
    if ('error' in normalized) return { success: false, error: normalized.error }
    jtsToCreate = normalized
  }

  const { data: semester, error: insertError } = await admin
    .from('semesters')
    .insert({
      name,
      start_date: input.startDate,
      end_date: input.endDate,
      year_id: yearResult.yearId,
      is_active: true,
    })
    .select('id')
    .single()

  if (insertError || !semester) {
    return { success: false, error: 'Failed to create semester.' }
  }

  if (jtsToCreate) {
    const deactivateError = await deactivateActiveJtFamilies(admin)
    if (deactivateError) {
      return { success: false, error: 'Semester created but failed to deactivate prior Jiatings.' }
    }

    const { error: jtError } = await insertJtFamiliesForYear(
      admin,
      yearResult.yearId,
      semester.id,
      jtsToCreate,
    )
    if (jtError) {
      return { success: false, error: 'Semester created but failed to create Jiatings.' }
    }
  }

  return {
    success: true,
    error: null,
    createdJiatings: Boolean(jtsToCreate),
    yearName: yearResult.yearName,
  }
}

export async function updateSemester(input: {
  id: string
  name: string
  startDate: string
  endDate: string
}) {
  const { error: authError } = await requireAdmin()
  if (authError) return { success: false, error: authError }

  const name = input.name.trim()
  if (!name) return { success: false, error: 'Semester name is required.' }
  if (!input.startDate || !input.endDate) {
    return { success: false, error: 'Start and end dates are required.' }
  }
  if (input.startDate > input.endDate) {
    return { success: false, error: 'End date must be on or after start date.' }
  }

  const admin = createAdminSupabase()

  const { data: semester } = await admin
    .from('semesters')
    .select('id, is_active, year_id')
    .eq('id', input.id)
    .maybeSingle()

  if (!semester) return { success: false, error: 'Semester not found.' }
  if (!semester.is_active) return { success: false, error: 'Only the active semester can be edited.' }

  const yearResult = await ensureYearId(admin, input.startDate)
  if ('error' in yearResult) return { success: false, error: yearResult.error }

  if (yearResult.yearId !== semester.year_id) {
    const { count } = await admin
      .from('jt_families')
      .select('id', { count: 'exact', head: true })
      .eq('year_id', semester.year_id)

    if ((count ?? 0) > 0) {
      return {
        success: false,
        error:
          'Changing dates to a different school year would leave Jiatings on the old year. Adjust dates within the same school year, or manage Jiatings separately.',
      }
    }
  }

  const { error } = await admin
    .from('semesters')
    .update({
      name,
      start_date: input.startDate,
      end_date: input.endDate,
      year_id: yearResult.yearId,
    })
    .eq('id', input.id)

  if (error) return { success: false, error: 'Failed to update semester.' }

  return {
    success: true,
    error: null,
    yearId: yearResult.yearId,
    yearName: yearResult.yearName,
  }
}

export async function createJtFamily(input: { name: string; color: string }) {
  const { error: authError } = await requireAdmin()
  if (authError) return { success: false, error: authError, family: null }

  const name = input.name.trim()
  const color = (input.color.trim() || randomJtColor())
  if (!name) return { success: false, error: 'Jiating name is required.', family: null }
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return { success: false, error: 'Use a hex color like #4f6ef7.', family: null }
  }

  const admin = createAdminSupabase()
  const { data: active } = await admin
    .from('semesters')
    .select('id, year_id')
    .eq('is_active', true)
    .maybeSingle()

  if (!active?.year_id) {
    return { success: false, error: 'No active semester with a school year.', family: null }
  }

  const { data, error } = await admin
    .from('jt_families')
    .insert({
      name,
      color,
      year_id: active.year_id,
      semester: active.id,
      is_active: true,
    })
    .select('id, name, color, year_id, is_active')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: `An active Jiating named "${name}" already exists.`, family: null }
    }
    return { success: false, error: 'Failed to create Jiating.', family: null }
  }

  return { success: true, error: null, family: data }
}

export async function updateJtFamily(input: { id: string; name: string; color: string }) {
  const { error: authError } = await requireAdmin()
  if (authError) return { success: false, error: authError, family: null }

  const name = input.name.trim()
  const color = input.color.trim()
  if (!name) return { success: false, error: 'Jiating name is required.', family: null }
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return { success: false, error: 'Use a hex color like #4f6ef7.', family: null }
  }

  const admin = createAdminSupabase()

  const { data: active } = await admin
    .from('semesters')
    .select('id, year_id')
    .eq('is_active', true)
    .maybeSingle()

  if (!active?.year_id) {
    return { success: false, error: 'No active semester.', family: null }
  }

  const { data: existing } = await admin
    .from('jt_families')
    .select('id, year_id, is_active')
    .eq('id', input.id)
    .maybeSingle()

  if (!existing || !existing.is_active) {
    return { success: false, error: 'Jiating not found or inactive.', family: null }
  }
  if (existing.year_id !== active.year_id) {
    return { success: false, error: 'Can only edit Jiatings for the active school year.', family: null }
  }

  const { data, error } = await admin
    .from('jt_families')
    .update({ name, color })
    .eq('id', input.id)
    .select('id, name, color, year_id, is_active')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: `An active Jiating named "${name}" already exists.`, family: null }
    }
    return { success: false, error: 'Failed to update Jiating.', family: null }
  }

  return { success: true, error: null, family: data }
}

export async function deactivateJtFamily(id: string) {
  const { error: authError } = await requireAdmin()
  if (authError) return { success: false, error: authError }

  const admin = createAdminSupabase()

  const { data: active } = await admin
    .from('semesters')
    .select('id, year_id')
    .eq('is_active', true)
    .maybeSingle()

  if (!active?.year_id) {
    return { success: false, error: 'No active semester.' }
  }

  const { data: existing } = await admin
    .from('jt_families')
    .select('id, year_id, is_active, name')
    .eq('id', id)
    .maybeSingle()

  if (!existing || !existing.is_active) {
    return { success: false, error: 'Jiating not found or already inactive.' }
  }
  if (existing.year_id !== active.year_id) {
    return { success: false, error: 'Can only deactivate Jiatings for the active school year.' }
  }

  const { error } = await admin
    .from('jt_families')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { success: false, error: 'Failed to deactivate Jiating.' }

  return { success: true, error: null }
}

/** Replace mislinked / prior-year active JTs with JT 1–6 for the active semester's school year. */
export async function bootstrapYearPlaceholders() {
  const { error: authError } = await requireAdmin()
  if (authError) return { success: false, error: authError }

  const admin = createAdminSupabase()

  const { data: active } = await admin
    .from('semesters')
    .select('id, year_id')
    .eq('is_active', true)
    .maybeSingle()

  if (!active?.year_id) {
    return { success: false, error: 'No active semester with a school year.' }
  }

  const deactivateError = await deactivateActiveJtFamilies(admin)
  if (deactivateError) {
    return { success: false, error: 'Failed to deactivate prior Jiatings.' }
  }

  const placeholders = defaultPlaceholders()
  const { data, error } = await insertJtFamiliesForYear(
    admin,
    active.year_id,
    active.id,
    placeholders,
  )

  if (error) return { success: false, error: 'Failed to create placeholder Jiatings.' }

  return { success: true, error: null, families: data ?? [] }
}

export interface SemesterJtFamily {
  id: string | null
  name: string
  color: string | null
  year_id: string | null
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
  /** True when active JTs belong to a different (or missing) year than this semester. */
  jtYearMismatch: boolean
}

export async function listSemesters() {
  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { semesters: [] as SemesterListItem[], error: authError }

  const [
    { data: semesters, error: semestersError },
    { data: jtFamilies, error: jtError },
    { data: events, error: eventsError },
    { data: summaries, error: summariesError },
  ] = await Promise.all([
    supabase
      .from('semesters')
      .select('id, name, start_date, end_date, is_active, year_id, years(name)')
      .order('start_date', { ascending: false }),
    fetchAllPages<{
      id: string
      name: string
      color: string | null
      semester: string | null
      year_id: string | null
      is_active: boolean
    }>((from, to) =>
      supabase
        .from('jt_families')
        .select('id, name, color, semester, year_id, is_active')
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

  if (semestersError || jtError || eventsError || summariesError) {
    return { semesters: [] as SemesterListItem[], error: 'Failed to load semesters.' }
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

  const jtsByYear = new Map<string, SemesterJtFamily[]>()
  const activeJtFamilies: SemesterJtFamily[] = []
  for (const jt of jtFamilies) {
    const item: SemesterJtFamily = {
      id: jt.id,
      name: jt.name,
      color: jt.color,
      year_id: jt.year_id,
    }
    if (jt.is_active) {
      activeJtFamilies.push(item)
    }
    if (jt.year_id) {
      const list = jtsByYear.get(jt.year_id) ?? []
      // Prefer active rows; include inactive year-linked for closed-term display only when no actives
      if (jt.is_active) {
        list.push(item)
        jtsByYear.set(jt.year_id, list)
      } else if (!jtsByYear.has(jt.year_id)) {
        // defer inactive fill until after we know if any actives exist per year
      }
    }
  }

  // For years with no active JTs, show inactive year-linked names (past years)
  const inactiveByYear = new Map<string, SemesterJtFamily[]>()
  for (const jt of jtFamilies) {
    if (!jt.year_id || jt.is_active) continue
    const list = inactiveByYear.get(jt.year_id) ?? []
    list.push({ id: jt.id, name: jt.name, color: jt.color, year_id: jt.year_id })
    inactiveByYear.set(jt.year_id, list)
  }
  for (const [yearId, inactive] of inactiveByYear) {
    if (!jtsByYear.has(yearId)) {
      jtsByYear.set(yearId, inactive)
    }
  }

  const enriched: SemesterListItem[] = (semesters ?? []).map(semester => {
    const yearJts = jtsByYear.get(semester.year_id) ?? []
    const archivedJtNames = summaryJtNames.get(semester.id)
    const archivedJts: SemesterJtFamily[] = archivedJtNames
      ? [...archivedJtNames].sort().map(name => ({
          id: null,
          name,
          color: null,
          year_id: semester.year_id,
        }))
      : []

    let jtFamiliesForSemester = yearJts
    let jtYearMismatch = false

    if (semester.is_active) {
      const activeForYear = activeJtFamilies.filter(j => j.year_id === semester.year_id)
      if (activeForYear.length > 0) {
        jtFamiliesForSemester = activeForYear
      } else if (activeJtFamilies.length > 0) {
        // Mislinked: active JTs exist but for another / null year (Spring placeholders)
        jtFamiliesForSemester = activeJtFamilies
        jtYearMismatch = true
      } else {
        jtFamiliesForSemester = []
      }
    } else if (jtFamiliesForSemester.length === 0) {
      jtFamiliesForSemester = archivedJts
    }

    return {
      ...semester,
      jtFamilies: jtFamiliesForSemester,
      eventCount: eventCounts.get(semester.id) ?? 0,
      memberCount: memberCounts.get(semester.id) ?? 0,
      jtYearMismatch,
    }
  })

  return { semesters: enriched, error: null }
}

/** Preview whether starting a semester with this start date would create new JTs. */
export async function previewStartSemesterYear(startDate: string) {
  const { error: authError } = await requireAdmin()
  if (authError) return { yearName: '', yearHasJts: false, error: authError }

  const yearName = schoolYearFromStartDate(startDate)
  if (!yearName) return { yearName: '', yearHasJts: false, error: 'Invalid start date.' }

  const supabase = await createActionSupabase()
  const { data: year } = await supabase
    .from('years')
    .select('id')
    .eq('name', yearName)
    .maybeSingle()

  if (!year) {
    return { yearName, yearHasJts: false, error: null }
  }

  const { count } = await supabase
    .from('jt_families')
    .select('id', { count: 'exact', head: true })
    .eq('year_id', year.id)
    .eq('is_active', true)

  return { yearName, yearHasJts: (count ?? 0) > 0, error: null }
}
