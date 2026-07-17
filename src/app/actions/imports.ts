'use server'

import { fetchAllPages } from '@/utils/supabase/fetchAll'
import { createActionSupabase } from '@/utils/supabase/action'
import {
  isCsaWideMixersCategory,
  isImportCheckIn,
  isManualPointsCheckIn,
} from '@/utils/events'
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

function organizationIsCsa(organization: string | null | undefined): boolean {
  return (organization ?? '').toLowerCase().includes('csa')
}

type CheckInMethod = 'csv_import' | 'manual'

type StagingInsert = {
  event_id: string
  kind: EventImportKind
  email: string
  full_name: string | null
  organization: string | null
  points: number | null
  member_id: string | null
  is_guest: boolean
  applied: boolean
}

type AttendanceInsert = {
  member_id: string
  event_id: string
  semester_id: string
  check_in_method: CheckInMethod
  recorded_by: string
  point_value_override?: number
}

/**
 * Upsert attendance first, then prune members no longer in the CSV,
 * then replace staging. Avoids wiping points if a later insert fails.
 */
async function syncImportData(
  supabase: ActionSupabase,
  eventId: string,
  checkInMethod: CheckInMethod,
  attendanceInserts: AttendanceInsert[],
  stagingInserts: StagingInsert[],
): Promise<string | null> {
  const chunkSize = 200
  const keepIds = attendanceInserts.map(row => row.member_id)

  for (let i = 0; i < attendanceInserts.length; i += chunkSize) {
    const chunk = attendanceInserts.slice(i, i + chunkSize)
    const { error } = await supabase.from('attendance').upsert(chunk, {
      onConflict: 'member_id,event_id',
    })
    if (error) {
      return 'Failed to save attendance. Existing check-ins were left unchanged.'
    }
  }

  let pruneQuery = supabase
    .from('attendance')
    .delete()
    .eq('event_id', eventId)
    .eq('check_in_method', checkInMethod)

  if (keepIds.length > 0) {
    pruneQuery = pruneQuery.not(
      'member_id',
      'in',
      `(${keepIds.join(',')})`,
    )
  }

  const { error: pruneError } = await pruneQuery
  if (pruneError) {
    return 'Attendance was updated, but failed to remove people no longer on the CSV. Re-upload to retry.'
  }

  const { error: deleteStagingError } = await supabase
    .from('event_import_rows')
    .delete()
    .eq('event_id', eventId)

  if (deleteStagingError) {
    return 'Attendance was updated, but failed to refresh the import list. Re-upload to retry.'
  }

  for (let i = 0; i < stagingInserts.length; i += chunkSize) {
    const chunk = stagingInserts.slice(i, i + chunkSize)
    const { error } = await supabase.from('event_import_rows').insert(chunk)
    if (error) {
      return 'Attendance was updated, but failed to save the import list. Re-upload to retry.'
    }
  }

  return null
}

export type EventImportKind = 'mixer_attendance' | 'manual_points'

export interface MixerCsvRow {
  fullName: string
  email: string
  organization: string
}

export interface ManualPointsCsvRow {
  fullName: string
  email: string
  points: number
}

export interface EventImportRow {
  id: string
  email: string
  full_name: string | null
  organization: string | null
  points: number | null
  member_id: string | null
  is_guest: boolean
  applied: boolean
  kind: EventImportKind
  member_name: string | null
}

export async function listEventImportRows(eventId: string) {
  const { supabase, error: authError } = await requireOfficer()
  if (authError) {
    return {
      rows: [] as EventImportRow[],
      matchedCount: 0,
      unmatchedCount: 0,
      guestCount: 0,
      hasUpload: false,
      error: authError,
    }
  }

  const { data, error } = await fetchAllPages<{
    id: string
    email: string
    full_name: string | null
    organization: string | null
    points: number | null
    member_id: string | null
    is_guest: boolean
    applied: boolean
    kind: EventImportKind
    members: { full_name: string } | { full_name: string }[] | null
  }>((from, to) =>
    supabase
      .from('event_import_rows')
      .select(
        'id, email, full_name, organization, points, member_id, is_guest, applied, kind, members(full_name)',
      )
      .eq('event_id', eventId)
      .order('email')
      .range(from, to),
  )

  if (error) {
    return {
      rows: [] as EventImportRow[],
      matchedCount: 0,
      unmatchedCount: 0,
      guestCount: 0,
      hasUpload: false,
      error: 'Failed to load import list.',
    }
  }

  const rows: EventImportRow[] = data.map(row => {
    const member = Array.isArray(row.members) ? row.members[0] : row.members
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      organization: row.organization,
      points: row.points,
      member_id: row.member_id,
      is_guest: row.is_guest,
      applied: row.applied,
      kind: row.kind,
      member_name: member?.full_name ?? null,
    }
  })

  let matchedCount = 0
  let unmatchedCount = 0
  let guestCount = 0
  for (const row of rows) {
    if (row.is_guest) guestCount++
    else if (row.member_id) matchedCount++
    else unmatchedCount++
  }

  return {
    rows,
    matchedCount,
    unmatchedCount,
    guestCount,
    hasUpload: rows.length > 0,
    error: null,
  }
}

/** Clear all import staging + import-method attendance for an event. */
export async function clearEventImport(eventId: string) {
  const { supabase, error: authError } = await requireOfficer()
  if (authError) return { success: false as const, error: authError }

  const { data: event } = await supabase
    .from('events')
    .select('id, check_in_type, publish_status')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) return { success: false as const, error: 'Event not found.' }
  if (!isImportCheckIn(event.check_in_type)) {
    return { success: false as const, error: 'This event does not use CSV import.' }
  }
  if (event.publish_status !== 'published') {
    return {
      success: false as const,
      error: 'Publish this event before clearing imports.',
    }
  }

  const method: CheckInMethod = isManualPointsCheckIn(event.check_in_type)
    ? 'manual'
    : 'csv_import'

  const syncError = await syncImportData(supabase, eventId, method, [], [])
  if (syncError) return { success: false as const, error: syncError }
  return { success: true as const, error: null }
}

/** Replace mixer attendance from a shared multi-org Google Form CSV. */
export async function replaceMixerAttendanceCsv(
  eventId: string,
  rows: MixerCsvRow[],
) {
  const { supabase, member: officer, error: authError } = await requireOfficer()
  if (authError) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors: [authError],
    }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, category, check_in_type, semester_id, publish_status')
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
  if (!isCsaWideMixersCategory(event.category) || event.check_in_type !== 'csv_import') {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors: ['CSV attendance import is only for CSA-Wide Mixers events.'],
    }
  }
  if (event.publish_status !== 'published') {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors: ['Publish this event before importing attendance.'],
    }
  }

  // Empty upload = clear all (explicit wipe).
  if (rows.length === 0) {
    const syncError = await syncImportData(
      supabase,
      eventId,
      'csv_import',
      [],
      [],
    )
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
    { email: string; fullName: string; organization: string }
  >()

  for (const row of rows) {
    const email = normalizeEmail(row.email ?? '')
    const fullName = (row.fullName ?? '').trim()
    const organization = (row.organization ?? '').trim()

    if (!organizationIsCsa(organization)) {
      skipped++
      continue
    }

    if (!email) {
      errors.push(`Skipped a CSA row with blank email${fullName ? ` (${fullName})` : ''}.`)
      continue
    }
    if (!email.includes('@')) {
      errors.push(`${email} — not a valid email.`)
      continue
    }
    if (byEmail.has(email)) {
      errors.push(`${email} — duplicate row; using the last entry.`)
    }
    byEmail.set(email, { email, fullName, organization })
  }

  if (byEmail.size === 0) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped,
      errors:
        errors.length > 0
          ? errors
          : [
              skipped > 0
                ? 'CSV had no CSA organization rows — previous import was left unchanged.'
                : 'CSV had no usable emails — previous import was left unchanged.',
            ],
    }
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

  const stagingInserts: StagingInsert[] = []
  const attendanceInserts: AttendanceInsert[] = []

  for (const { email, fullName, organization } of byEmail.values()) {
    const memberId = memberByEmail.get(email) ?? null
    stagingInserts.push({
      event_id: eventId,
      kind: 'mixer_attendance',
      email,
      full_name: fullName || null,
      organization: organization || null,
      points: null,
      member_id: memberId,
      is_guest: false,
      applied: Boolean(memberId),
    })
    if (memberId) {
      attendanceInserts.push({
        member_id: memberId,
        event_id: eventId,
        semester_id: event.semester_id,
        check_in_method: 'csv_import',
        recorded_by: officer!.id,
      })
    }
  }

  const syncError = await syncImportData(
    supabase,
    eventId,
    'csv_import',
    attendanceInserts,
    stagingInserts,
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

  return {
    success: true as const,
    matched: attendanceInserts.length,
    unmatched: stagingInserts.length - attendanceInserts.length,
    skipped,
    errors,
  }
}

/** Replace monetary / manual philanthropy points from CSV. */
export async function replaceManualPointsCsv(
  eventId: string,
  rows: ManualPointsCsvRow[],
) {
  const { supabase, member: officer, error: authError } = await requireOfficer()
  if (authError) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors: [authError],
    }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, category, check_in_type, semester_id, publish_status')
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
  if (!isManualPointsCheckIn(event.check_in_type)) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors: ['Manual points import is only for Manual Points events.'],
    }
  }
  if (event.publish_status !== 'published') {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors: ['Publish this event before importing points.'],
    }
  }

  if (rows.length === 0) {
    const syncError = await syncImportData(supabase, eventId, 'manual', [], [])
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
  const byEmail = new Map<
    string,
    { email: string; fullName: string; points: number }
  >()

  for (const row of rows) {
    const email = normalizeEmail(row.email ?? '')
    const fullName = (row.fullName ?? '').trim()
    const points = Number(row.points)

    if (!email) {
      errors.push(`Skipped a row with blank email${fullName ? ` (${fullName})` : ''}.`)
      continue
    }
    if (!email.includes('@')) {
      errors.push(`${email} — not a valid email.`)
      continue
    }
    if (!Number.isFinite(points) || !Number.isInteger(points) || points < 1) {
      errors.push(
        `${email} — points must be a positive whole number (got ${row.points}).`,
      )
      continue
    }
    if (points > 100) {
      errors.push(`${email} — points ${points} exceeds the max of 100 per row.`)
      continue
    }
    if (byEmail.has(email)) {
      const prev = byEmail.get(email)!
      errors.push(
        `${email} — duplicate row; using the last entry (${points} pts, was ${prev.points}).`,
      )
    }
    byEmail.set(email, { email, fullName, points })
  }

  if (byEmail.size === 0) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      errors:
        errors.length > 0
          ? errors
          : ['CSV had no usable rows — previous import was left unchanged.'],
    }
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
      skipped: 0,
      errors: [lookupError],
    }
  }

  const stagingInserts: StagingInsert[] = []
  const attendanceInserts: AttendanceInsert[] = []

  for (const { email, fullName, points } of byEmail.values()) {
    const memberId = memberByEmail.get(email) ?? null
    stagingInserts.push({
      event_id: eventId,
      kind: 'manual_points',
      email,
      full_name: fullName || null,
      organization: null,
      points,
      member_id: memberId,
      is_guest: false,
      applied: Boolean(memberId),
    })
    if (memberId) {
      attendanceInserts.push({
        member_id: memberId,
        event_id: eventId,
        semester_id: event.semester_id,
        check_in_method: 'manual',
        recorded_by: officer!.id,
        point_value_override: points,
      })
    }
  }

  const syncError = await syncImportData(
    supabase,
    eventId,
    'manual',
    attendanceInserts,
    stagingInserts,
  )
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
    matched: attendanceInserts.length,
    unmatched: stagingInserts.length - attendanceInserts.length,
    skipped: 0,
    errors,
  }
}

export async function matchImportRow(rowId: string, memberId: string) {
  const { supabase, member: officer, error: authError } = await requireOfficer()
  if (authError) return { success: false, error: authError }

  const { data: row } = await supabase
    .from('event_import_rows')
    .select(
      'id, event_id, kind, email, full_name, points, is_guest, applied, member_id',
    )
    .eq('id', rowId)
    .maybeSingle()

  if (!row) return { success: false, error: 'Import row not found.' }

  const { data: event } = await supabase
    .from('events')
    .select('id, semester_id, check_in_type, publish_status')
    .eq('id', row.event_id)
    .maybeSingle()

  if (!event) return { success: false, error: 'Event not found.' }
  if (event.publish_status !== 'published') {
    return { success: false, error: 'Publish this event before applying matches.' }
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

  const isManual = row.kind === 'manual_points'
  if (isManual && (row.points == null || row.points < 1)) {
    return { success: false, error: 'This row has no valid points amount.' }
  }

  const attendancePayload: Record<string, unknown> = {
    member_id: memberId,
    event_id: row.event_id,
    semester_id: event.semester_id,
    check_in_method: isManual ? 'manual' : 'csv_import',
    recorded_by: officer!.id,
  }
  if (isManual) {
    attendancePayload.point_value_override = row.points
  }

  const { error: attendanceError } = await supabase
    .from('attendance')
    .insert(attendancePayload)

  if (attendanceError) {
    if (attendanceError.code === '23505') {
      return {
        success: false,
        error: 'That member already has attendance for this event.',
      }
    }
    return { success: false, error: 'Failed to create attendance.' }
  }

  const { error } = await supabase
    .from('event_import_rows')
    .update({
      member_id: memberId,
      is_guest: false,
      applied: true,
      email: normalizeEmail(member.email),
      full_name: member.full_name,
    })
    .eq('id', rowId)

  if (error) {
    return {
      success: false,
      error: 'Attendance created, but failed to update the import row.',
    }
  }

  return { success: true, error: null }
}

export async function dismissImportRowAsGuest(rowId: string) {
  const { supabase, error: authError } = await requireOfficer()
  if (authError) return { success: false, error: authError }

  const { data: row } = await supabase
    .from('event_import_rows')
    .select('id, event_id, member_id, applied')
    .eq('id', rowId)
    .maybeSingle()

  if (!row) return { success: false, error: 'Import row not found.' }

  if (row.applied && row.member_id) {
    await supabase
      .from('attendance')
      .delete()
      .eq('event_id', row.event_id)
      .eq('member_id', row.member_id)
  }

  const { error } = await supabase
    .from('event_import_rows')
    .update({ member_id: null, is_guest: true, applied: false })
    .eq('id', rowId)

  if (error) return { success: false, error: 'Failed to mark as guest.' }
  return { success: true, error: null }
}
