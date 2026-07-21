'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllPages } from '@/utils/supabase/fetchAll'
import { createActionSupabase } from '@/utils/supabase/action'
import { isHowdyWeekCategory } from '@/utils/events'
import {
  lookupMembersByEmail,
  normalizeEmail,
} from '@/utils/member-lookup'

type ActionSupabase = Awaited<ReturnType<typeof createActionSupabase>>

async function requireOfficer() {
  const supabase = await createActionSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Not authenticated.' as const }

  const { data: member } = await supabase
    .from('members')
    .select('id, role')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!member || !['officer', 'admin'].includes(member.role)) {
    return { supabase, error: 'Officer access required.' as const }
  }

  return { supabase, member, error: null }
}

function isTamuEmail(email: string): boolean {
  return email.endsWith('@tamu.edu')
}

export interface HowdyWeekCsvRow {
  fullName: string
  email: string
  graduationYear: number
}

export interface EventGuestRow {
  id: string
  email: string
  full_name: string | null
  graduation_year: number | null
  member_id: string | null
  member_name: string | null
}

async function replaceGuestRows(
  supabase: ActionSupabase,
  eventId: string,
  rows: {
    email: string
    full_name: string | null
    graduation_year: number | null
    member_id: string | null
  }[],
  recordedBy: string,
): Promise<string | null> {
  const { error } = await supabase.rpc('replace_event_guests', {
    p_event_id: eventId,
    p_rows: rows.map(row => ({
      email: row.email,
      full_name: row.full_name,
      graduation_year: row.graduation_year,
      member_id: row.member_id,
    })),
    p_recorded_by: recordedBy,
  })

  if (error) {
    return 'Failed to apply the guest list. No changes were saved — please try again.'
  }
  return null
}

export async function listEventGuests(eventId: string) {
  const { supabase, error: authError } = await requireOfficer()
  if (authError) {
    return {
      rows: [] as EventGuestRow[],
      matchedCount: 0,
      unmatchedCount: 0,
      hasUpload: false,
      error: authError,
    }
  }

  const { data, error } = await fetchAllPages<{
    id: string
    email: string
    full_name: string | null
    graduation_year: number | null
    member_id: string | null
    members: { full_name: string } | { full_name: string }[] | null
  }>((from, to) =>
    supabase
      .from('event_guests')
      .select(
        'id, email, full_name, graduation_year, member_id, members(full_name)',
      )
      .eq('event_id', eventId)
      .order('email')
      .range(from, to),
  )

  if (error) {
    return {
      rows: [] as EventGuestRow[],
      matchedCount: 0,
      unmatchedCount: 0,
      hasUpload: false,
      error: 'Failed to load guest list.',
    }
  }

  const rows: EventGuestRow[] = data.map(row => {
    const member = Array.isArray(row.members) ? row.members[0] : row.members
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      graduation_year: row.graduation_year,
      member_id: row.member_id,
      member_name: member?.full_name ?? null,
    }
  })

  let matchedCount = 0
  let unmatchedCount = 0
  for (const row of rows) {
    if (row.member_id) matchedCount++
    else unmatchedCount++
  }

  return {
    rows,
    matchedCount,
    unmatchedCount,
    hasUpload: rows.length > 0,
    error: null as string | null,
  }
}

export async function replaceHowdyWeekGuestsCsv(
  eventId: string,
  rows: HowdyWeekCsvRow[],
) {
  const { supabase, member: officer, error: authError } = await requireOfficer()
  if (authError || !officer) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors: [authError ?? 'Officer access required.'],
    }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, category, check_in_type, publish_status, semester_id')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors: ['Event not found.'],
    }
  }
  if (!isHowdyWeekCategory(event.category) || event.check_in_type !== 'csv_import') {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors: ['Guest CSV import is only for Howdy Week events.'],
    }
  }
  if (event.publish_status !== 'published') {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors: ['Publish this event before importing guests.'],
    }
  }

  if (rows.length === 0) {
    const syncError = await replaceGuestRows(supabase, eventId, [], officer.id)
    if (syncError) {
      return {
        success: false as const,
        matched: 0,
        unmatched: 0,
        skipped: 0,
        errors: [syncError],
      }
    }
    return {
      success: true as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      cleared: true as const,
      errors: [] as string[],
    }
  }

  const errors: string[] = []
  let skipped = 0
  const byEmail = new Map<
    string,
    { email: string; fullName: string; graduationYear: number }
  >()

  for (const row of rows) {
    const email = normalizeEmail(row.email ?? '')
    const fullName = (row.fullName ?? '').trim()
    const year = row.graduationYear

    if (!email) {
      skipped++
      continue
    }
    if (!isTamuEmail(email)) {
      skipped++
      errors.push(`Skipped non-@tamu.edu email: ${email}`)
      continue
    }
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      skipped++
      errors.push(`Skipped invalid year for ${email}`)
      continue
    }

    byEmail.set(email, { email, fullName, graduationYear: year })
  }

  const emails = [...byEmail.keys()]
  const { memberByEmail, error: lookupError } = await lookupMembersByEmail(
    supabase,
    emails,
  )
  if (lookupError) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped,
      errors: [lookupError],
    }
  }

  const guestInserts = [...byEmail.values()].map(row => ({
    email: row.email,
    full_name: row.fullName || null,
    graduation_year: row.graduationYear,
    member_id: memberByEmail.get(row.email) ?? null,
  }))

  const syncError = await replaceGuestRows(
    supabase,
    eventId,
    guestInserts,
    officer.id,
  )
  if (syncError) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped,
      errors: [syncError],
    }
  }

  const matched = guestInserts.filter(r => r.member_id).length
  return {
    success: true as const,
    matched,
    unmatched: guestInserts.length - matched,
    skipped,
    errors,
  }
}

export async function clearEventGuests(eventId: string) {
  const { supabase, member: officer, error: authError } = await requireOfficer()
  if (authError || !officer) {
    return { success: false, error: authError ?? 'Officer access required.' }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, category, check_in_type')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) return { success: false, error: 'Event not found.' }
  if (!isHowdyWeekCategory(event.category) || event.check_in_type !== 'csv_import') {
    return { success: false, error: 'Guest clear is only for Howdy Week events.' }
  }

  const syncError = await replaceGuestRows(supabase, eventId, [], officer.id)
  if (syncError) return { success: false, error: syncError }
  return { success: true, error: null as string | null }
}

export async function matchGuestRow(guestId: string, memberId: string) {
  const { supabase, member: officer, error: authError } = await requireOfficer()
  if (authError || !officer) {
    return { success: false, error: authError ?? 'Officer access required.' }
  }

  const { data: row } = await supabase
    .from('event_guests')
    .select('id, event_id, email, member_id, semester_id')
    .eq('id', guestId)
    .maybeSingle()

  if (!row) return { success: false, error: 'Guest row not found.' }

  const { data: event } = await supabase
    .from('events')
    .select('id, category, publish_status, semester_id')
    .eq('id', row.event_id)
    .maybeSingle()

  if (!event) return { success: false, error: 'Event not found.' }
  if (!isHowdyWeekCategory(event.category)) {
    return { success: false, error: 'Not a Howdy Week event.' }
  }
  if (event.publish_status !== 'published') {
    return { success: false, error: 'Publish this event before matching guests.' }
  }

  const { data: member } = await supabase
    .from('members')
    .select('id, full_name, email')
    .eq('id', memberId)
    .maybeSingle()

  if (!member) return { success: false, error: 'Member not found.' }

  const { data: existingAttendance } = await supabase
    .from('attendance')
    .select('id')
    .eq('event_id', row.event_id)
    .eq('member_id', memberId)
    .maybeSingle()

  if (existingAttendance) {
    return {
      success: false,
      error: 'That member already has attendance for this event.',
    }
  }

  const { error } = await supabase
    .from('event_guests')
    .update({
      member_id: memberId,
      email: normalizeEmail(member.email),
      full_name: member.full_name,
    })
    .eq('id', guestId)

  if (error) {
    if (error.code === '23505') {
      return {
        success: false,
        error: 'That member email is already on this guest list.',
      }
    }
    return { success: false, error: 'Failed to match guest.' }
  }

  const { error: attendanceError } = await supabase.from('attendance').insert({
    member_id: memberId,
    event_id: row.event_id,
    semester_id: row.semester_id ?? event.semester_id,
    check_in_method: 'csv_import',
    recorded_by: officer.id,
  })

  if (attendanceError) {
    if (attendanceError.code === '23505') {
      return {
        success: false,
        error: 'That member already has attendance for this event.',
      }
    }
    return { success: false, error: 'Matched guest but failed to record attendance.' }
  }

  return { success: true, error: null as string | null }
}

/**
 * Link unmatched Howdy Week guest rows to a member by email and create
 * 0-point attendance. Soft-fails so registration/import is never blocked.
 */
export async function linkEventGuestsByEmail(
  supabase: SupabaseClient,
  memberId: string,
  email: string | null | undefined,
) {
  const normalized = normalizeEmail(email ?? '')
  if (!normalized) return

  try {
    await supabase.rpc('claim_howdy_week_guests_for_member', {
      p_member_id: memberId,
      p_email: normalized,
    })
  } catch {
    // Soft-fail: badge/rematch can still fix linkage later.
  }
}

/**
 * Distinct Howdy Week events attended (linked guest rows) in a semester, per member.
 * Counts event_guests only (Howdy Week is the sole writer); no events join so pending
 * members can read their own badge without events SELECT RLS.
 */
export async function countHowdyWeekAttendanceByMemberIds(
  supabase: SupabaseClient,
  memberIds: string[],
  semesterId: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (memberIds.length === 0 || !semesterId) return counts

  const { data, error } = await fetchAllPages<{
    member_id: string | null
    event_id: string
  }>((from, to) =>
    supabase
      .from('event_guests')
      .select('member_id, event_id')
      .in('member_id', memberIds)
      .eq('semester_id', semesterId)
      .range(from, to),
  )

  if (error || !data) return counts

  const seen = new Map<string, Set<string>>()
  for (const row of data) {
    if (!row.member_id) continue
    let events = seen.get(row.member_id)
    if (!events) {
      events = new Set()
      seen.set(row.member_id, events)
    }
    events.add(row.event_id)
  }

  for (const [memberId, events] of seen) {
    counts.set(memberId, events.size)
  }
  return counts
}

export type HowdyWeekGuestSort = 'event_count' | 'name' | 'last_attended'

export interface HowdyWeekGuestProspectEvent {
  id: string
  name: string
  starts_at: string | null
}

export interface HowdyWeekGuestProspect {
  email: string
  full_name: string | null
  other_names: string[]
  graduation_year: number | null
  event_count: number
  last_attended_at: string | null
  events: HowdyWeekGuestProspectEvent[]
}

export interface HowdyWeekGuestProspectFilters {
  query?: string
  minEvents?: number
  eventId?: string | null
  sort?: HowdyWeekGuestSort
  page?: number
  pageSize?: number
}

function normalizeProspectFilters(input: HowdyWeekGuestProspectFilters) {
  const minEvents = Math.max(1, Number(input.minEvents) || 1)
  const sort: HowdyWeekGuestSort =
    input.sort === 'name' || input.sort === 'last_attended'
      ? input.sort
      : 'event_count'
  const page = Math.max(1, Number(input.page) || 1)
  const pageSize = Math.min(200, Math.max(1, Number(input.pageSize) || 25))
  return {
    query: (input.query ?? '').trim(),
    minEvents,
    eventId: input.eventId || null,
    sort,
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  }
}

export async function listHowdyWeekGuestProspects(
  filters: HowdyWeekGuestProspectFilters = {},
  client?: SupabaseClient,
) {
  let supabase = client

  if (!supabase) {
    const gated = await requireOfficer()
    if (gated.error) {
      return {
        rows: [] as HowdyWeekGuestProspect[],
        total: 0,
        semesterId: null as string | null,
        error: gated.error,
      }
    }
    supabase = gated.supabase
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: member } = await supabase
      .from('members')
      .select('id, role')
      .eq('auth_uid', user?.id ?? '')
      .maybeSingle()
    if (!member || !['officer', 'admin'].includes(member.role)) {
      return {
        rows: [] as HowdyWeekGuestProspect[],
        total: 0,
        semesterId: null as string | null,
        error: 'Officer access required.',
      }
    }
  }

  const { data: semester } = await supabase
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  if (!semester) {
    return {
      rows: [] as HowdyWeekGuestProspect[],
      total: 0,
      semesterId: null as string | null,
      error: null as string | null,
    }
  }

  const normalized = normalizeProspectFilters(filters)

  type GuestJoinRow = {
    email: string
    full_name: string | null
    graduation_year: number | null
    created_at: string
    event_id: string
    events:
      | { id: string; name: string; starts_at: string; category: string }
      | { id: string; name: string; starts_at: string; category: string }[]
      | null
  }

  const { data: rawRows, error } = await fetchAllPages<GuestJoinRow>((from, to) => {
    let q = supabase
      .from('event_guests')
      .select(
        'email, full_name, graduation_year, created_at, event_id, events!inner(id, name, starts_at, category)',
      )
      .eq('semester_id', semester.id)
      .is('member_id', null)

    if (normalized.eventId) {
      q = q.eq('event_id', normalized.eventId)
    }

    return q.order('email').range(from, to)
  })

  if (error) {
    console.error('listHowdyWeekGuestProspects query failed:', error)
    return {
      rows: [] as HowdyWeekGuestProspect[],
      total: 0,
      semesterId: semester.id,
      error: `Failed to load Howdy Week guests: ${error}`,
    }
  }

  type Agg = {
    email: string
    names: { name: string; at: string }[]
    years: { year: number; at: string }[]
    events: Map<string, HowdyWeekGuestProspectEvent>
  }

  const byEmail = new Map<string, Agg>()
  for (const row of rawRows) {
    const event = Array.isArray(row.events) ? row.events[0] : row.events
    if (!event || event.category !== 'Howdy Week') continue

    const email = normalizeEmail(row.email)
    if (!email) continue

    let agg = byEmail.get(email)
    if (!agg) {
      agg = { email, names: [], years: [], events: new Map() }
      byEmail.set(email, agg)
    }

    const stamp = row.created_at || event.starts_at || ''
    if (row.full_name?.trim()) {
      agg.names.push({ name: row.full_name.trim(), at: stamp })
    }
    if (row.graduation_year != null) {
      agg.years.push({ year: row.graduation_year, at: stamp })
    }
    if (!agg.events.has(event.id)) {
      agg.events.set(event.id, {
        id: event.id,
        name: event.name,
        starts_at: event.starts_at,
      })
    }
  }

  const q = normalized.query.toLowerCase()
  let prospects: HowdyWeekGuestProspect[] = [...byEmail.values()].map(agg => {
    const sortedNames = [...agg.names].sort((a, b) => b.at.localeCompare(a.at))
    const primaryName = sortedNames[0]?.name ?? null
    const otherNames = [
      ...new Set(
        sortedNames
          .map(n => n.name)
          .filter(n => n.toLowerCase() !== (primaryName ?? '').toLowerCase()),
      ),
    ]
    const sortedYears = [...agg.years].sort((a, b) => b.at.localeCompare(a.at))
    const events = [...agg.events.values()].sort((a, b) =>
      (b.starts_at ?? '').localeCompare(a.starts_at ?? ''),
    )
    const lastAttended =
      events.reduce<string | null>((max, ev) => {
        if (!ev.starts_at) return max
        if (!max || ev.starts_at > max) return ev.starts_at
        return max
      }, null)

    return {
      email: agg.email,
      full_name: primaryName,
      other_names: otherNames,
      graduation_year: sortedYears[0]?.year ?? null,
      event_count: events.length,
      last_attended_at: lastAttended,
      events,
    }
  })

  prospects = prospects.filter(p => {
    if (p.event_count < normalized.minEvents) return false
    if (!q) return true
    return (
      p.email.includes(q) ||
      (p.full_name ?? '').toLowerCase().includes(q) ||
      p.other_names.some(n => n.toLowerCase().includes(q))
    )
  })

  prospects.sort((a, b) => {
    if (normalized.sort === 'name') {
      return (a.full_name || a.email).localeCompare(b.full_name || b.email, undefined, {
        sensitivity: 'base',
      })
    }
    if (normalized.sort === 'last_attended') {
      return (b.last_attended_at ?? '').localeCompare(a.last_attended_at ?? '')
    }
    if (b.event_count !== a.event_count) return b.event_count - a.event_count
    return (a.full_name || a.email).localeCompare(b.full_name || b.email, undefined, {
      sensitivity: 'base',
    })
  })

  const total = prospects.length
  const rows = prospects.slice(
    normalized.offset,
    normalized.offset + normalized.pageSize,
  )

  return {
    rows,
    total,
    semesterId: semester.id,
    error: null as string | null,
  }
}

export async function rematchGuestEmail(email: string, memberId: string) {
  const { supabase, member: officer, error: authError } = await requireOfficer()
  if (authError || !officer) {
    return { success: false, linked: 0, error: authError ?? 'Officer access required.' }
  }

  const normalized = normalizeEmail(email)
  if (!normalized) return { success: false, linked: 0, error: 'Email is required.' }

  const { data: semester } = await supabase
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  if (!semester) {
    return { success: false, linked: 0, error: 'No active semester.' }
  }

  const { data: linked, error } = await supabase.rpc(
    'rematch_howdy_week_guest_email',
    {
      p_semester_id: semester.id,
      p_email: normalized,
      p_member_id: memberId,
      p_recorded_by: officer.id,
    },
  )

  if (error) {
    return {
      success: false,
      linked: 0,
      error: error.message || 'Failed to rematch guest.',
    }
  }

  return {
    success: true,
    linked: Number(linked) || 0,
    error: null as string | null,
  }
}

export async function exportHowdyWeekGuests(
  filters: HowdyWeekGuestProspectFilters = {},
) {
  const { supabase, member: officer, error: authError } = await requireOfficer()
  if (authError || !officer) {
    return { success: false as const, csv: null, rowCount: 0, error: authError ?? 'Officer access required.' }
  }

  const { data: semester } = await supabase
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  if (!semester) {
    return { success: false as const, csv: null, rowCount: 0, error: 'No active semester.' }
  }

  const normalized = normalizeProspectFilters({
    ...filters,
    page: 1,
    pageSize: 5000,
  })

  const listed = await listHowdyWeekGuestProspects(normalized, supabase)
  if (listed.error) {
    return {
      success: false as const,
      csv: null,
      rowCount: 0,
      error: listed.error,
    }
  }

  const rows = listed.rows

  const escape = (value: string) => {
    if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
    return value
  }

  const header = [
    'Name',
    'Email',
    'Year',
    'Event Count',
    'Last Attended',
    'Events',
  ]
  const lines = [
    header.join(','),
    ...rows.map(row =>
      [
        escape(row.full_name ?? ''),
        escape(row.email),
        row.graduation_year != null ? String(row.graduation_year) : '',
        String(row.event_count),
        row.last_attended_at
          ? new Date(row.last_attended_at).toISOString().slice(0, 10)
          : '',
        escape(row.events.map(e => e.name).join('; ')),
      ].join(','),
    ),
  ]

  const { error: logError } = await supabase.from('guest_export_log').insert({
    exported_by: officer.id,
    semester_id: semester.id,
    row_count: rows.length,
    filters: {
      q: normalized.query,
      minEvents: normalized.minEvents,
      eventId: normalized.eventId,
      sort: normalized.sort,
    },
  })

  if (logError) {
    return {
      success: false as const,
      csv: null,
      rowCount: 0,
      error: 'Failed to record export log.',
    }
  }

  return {
    success: true as const,
    csv: lines.join('\n') + '\n',
    rowCount: rows.length,
    error: null as string | null,
  }
}

export async function listRecentGuestExports(limit = 5) {
  const { supabase, error: authError } = await requireOfficer()
  if (authError) {
    return { rows: [] as { id: string; row_count: number; created_at: string; exporter_name: string | null }[], error: authError }
  }

  const { data, error } = await supabase
    .from('guest_export_log')
    .select('id, row_count, created_at, members!guest_export_log_exported_by_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return {
      rows: [],
      error: 'Failed to load export history.',
    }
  }

  return {
    rows: (data ?? []).map(row => {
      const member = Array.isArray(row.members) ? row.members[0] : row.members
      return {
        id: row.id as string,
        row_count: row.row_count as number,
        created_at: row.created_at as string,
        exporter_name: (member as { full_name?: string } | null)?.full_name ?? null,
      }
    }),
    error: null as string | null,
  }
}
