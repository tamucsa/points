'use server'

import { createActionSupabase } from '@/utils/supabase/action'
import { fetchAllPages } from '@/utils/supabase/fetchAll'
import {
  lookupMembersByEmail,
  normalizeEmail,
} from '@/utils/member-lookup'

async function requireOfficer() {
  const supabase = await createActionSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Not authenticated.' as const }

  const { data: member } = await supabase
    .from('members')
    .select('id, role')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!member || !['officer', 'admin'].includes(member.role)) {
    return { supabase, error: 'Officer access required.' as const }
  }

  return { supabase, error: null }
}

export interface RsvpCsvRow {
  fullName: string
  email: string
}

export interface EventRsvpRow {
  id: string
  email: string
  full_name: string | null
  member_id: string | null
  is_guest: boolean
  member_name: string | null
}

async function assertRsvpEvent(
  supabase: Awaited<ReturnType<typeof createActionSupabase>>,
  eventId: string,
) {
  const { data: event } = await supabase
    .from('events')
    .select('id, check_in_type')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) return { error: 'Event not found.' as const }
  if (event.check_in_type !== 'rsvp_required') {
    return { error: 'RSVP tagging is only available for RSVP events.' as const }
  }
  return { error: null }
}

export async function listEventRsvps(eventId: string) {
  const { supabase, error: authError } = await requireOfficer()
  if (authError) {
    return {
      rows: [] as EventRsvpRow[],
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
    member_id: string | null
    is_guest: boolean
    members: { full_name: string } | { full_name: string }[] | null
  }>((from, to) =>
    supabase
      .from('event_rsvps')
      .select('id, email, full_name, member_id, is_guest, members(full_name)')
      .eq('event_id', eventId)
      .order('email')
      .range(from, to),
  )

  if (error) {
    return {
      rows: [] as EventRsvpRow[],
      matchedCount: 0,
      unmatchedCount: 0,
      guestCount: 0,
      hasUpload: false,
      error: 'Failed to load RSVP list.',
    }
  }

  const rows: EventRsvpRow[] = data.map(row => {
    const member = Array.isArray(row.members) ? row.members[0] : row.members
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      member_id: row.member_id,
      is_guest: row.is_guest,
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

/** Replace all RSVP rows for an event with a fresh CSV (matched by email). */
export async function replaceEventRsvpCsv(eventId: string, rows: RsvpCsvRow[]) {
  const { supabase, error: authError } = await requireOfficer()
  if (authError) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      errors: [authError],
    }
  }

  const eventCheck = await assertRsvpEvent(supabase, eventId)
  if (eventCheck.error) {
    return { success: false as const, matched: 0, unmatched: 0, errors: [eventCheck.error] }
  }

  const errors: string[] = []
  const byEmail = new Map<string, { email: string; fullName: string }>()

  for (const row of rows) {
    const email = normalizeEmail(row.email ?? '')
    const fullName = (row.fullName ?? '').trim()
    if (!email) {
      errors.push(`Skipped a row with blank email${fullName ? ` (${fullName})` : ''}.`)
      continue
    }
    if (!email.includes('@')) {
      errors.push(`${email} — not a valid email.`)
      continue
    }
    // Last occurrence wins if CSV has duplicates
    byEmail.set(email, { email, fullName })
  }

  if (byEmail.size === 0) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      errors: errors.length > 0 ? errors : ['CSV had no usable email rows.'],
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
      errors: [lookupError],
    }
  }

  const inserts = [...byEmail.values()].map(({ email, fullName }) => {
    const memberId = memberByEmail.get(email) ?? null
    return {
      event_id: eventId,
      email,
      full_name: fullName || null,
      member_id: memberId,
      is_guest: false,
    }
  })

  const { error: deleteError } = await supabase
    .from('event_rsvps')
    .delete()
    .eq('event_id', eventId)

  if (deleteError) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      errors: ['Failed to clear the previous RSVP list.'],
    }
  }

  // Insert in chunks to stay under payload limits
  const chunkSize = 200
  for (let i = 0; i < inserts.length; i += chunkSize) {
    const chunk = inserts.slice(i, i + chunkSize)
    const { error: insertError } = await supabase.from('event_rsvps').insert(chunk)
    if (insertError) {
      return {
        success: false as const,
        matched: 0,
        unmatched: 0,
        errors: ['Failed to save RSVP rows. Previous list was cleared — please re-upload.'],
      }
    }
  }

  const matched = inserts.filter(r => r.member_id).length
  const unmatched = inserts.length - matched

  return {
    success: true as const,
    matched,
    unmatched,
    errors,
  }
}

export async function matchEventRsvpRow(rsvpId: string, memberId: string) {
  const { supabase, error: authError } = await requireOfficer()
  if (authError) return { success: false, error: authError }

  const { data: row } = await supabase
    .from('event_rsvps')
    .select('id, event_id, is_guest')
    .eq('id', rsvpId)
    .maybeSingle()

  if (!row) return { success: false, error: 'RSVP row not found.' }

  const eventCheck = await assertRsvpEvent(supabase, row.event_id)
  if (eventCheck.error) return { success: false, error: eventCheck.error }

  const { data: member } = await supabase
    .from('members')
    .select('id, full_name, email')
    .eq('id', memberId)
    .maybeSingle()

  if (!member) return { success: false, error: 'Member not found.' }

  // Avoid two rows for the same member on one event
  const { data: existing } = await supabase
    .from('event_rsvps')
    .select('id')
    .eq('event_id', row.event_id)
    .eq('member_id', memberId)
    .neq('id', rsvpId)
    .maybeSingle()

  if (existing) {
    return { success: false, error: 'That member is already tagged as RSVPed for this event.' }
  }

  const { error } = await supabase
    .from('event_rsvps')
    .update({
      member_id: memberId,
      is_guest: false,
      email: normalizeEmail(member.email),
      full_name: member.full_name,
    })
    .eq('id', rsvpId)

  if (error) return { success: false, error: 'Failed to match member.' }
  return { success: true, error: null }
}

export async function dismissEventRsvpAsGuest(rsvpId: string) {
  const { supabase, error: authError } = await requireOfficer()
  if (authError) return { success: false, error: authError }

  const { data: row } = await supabase
    .from('event_rsvps')
    .select('id, event_id')
    .eq('id', rsvpId)
    .maybeSingle()

  if (!row) return { success: false, error: 'RSVP row not found.' }

  const eventCheck = await assertRsvpEvent(supabase, row.event_id)
  if (eventCheck.error) return { success: false, error: eventCheck.error }

  const { error } = await supabase
    .from('event_rsvps')
    .update({ member_id: null, is_guest: true })
    .eq('id', rsvpId)

  if (error) return { success: false, error: 'Failed to mark as guest.' }
  return { success: true, error: null }
}
