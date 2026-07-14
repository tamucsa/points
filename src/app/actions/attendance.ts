'use server'

import { createActionSupabase } from '@/utils/supabase/action'

async function readCountedAfterTriggers(
  supabase: Awaited<ReturnType<typeof createActionSupabase>>,
  attendanceId: string,
) {
  const { data } = await supabase
    .from('attendance')
    .select('counted')
    .eq('id', attendanceId)
    .maybeSingle()
  return data?.counted ?? true
}

export async function selfCheckIn(eventId: string, _semesterId?: string) {
  const supabase = await createActionSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.', counted: false }

  const { data: member } = await supabase
    .from('members')
    .select('id, status')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!member) return { success: false, error: 'No member profile found.', counted: false }
  if (member.status !== 'active') {
    return { success: false, error: 'Your account must be active to check in.', counted: false }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, semester_id, check_in_type')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    return { success: false, error: 'Event not found.', counted: false }
  }
  if (event.check_in_type !== 'self') {
    return {
      success: false,
      error: 'This event does not support self check-in.',
      counted: false,
    }
  }

  const { data: inserted, error } = await supabase
    .from('attendance')
    .insert({
      member_id: member.id,
      event_id: eventId,
      semester_id: event.semester_id,
      check_in_method: 'qr_scan',
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'You have already checked in to this event.', counted: false }
    }
    return { success: false, error: 'Check-in failed. Please try again or ask an officer.', counted: false }
  }

  const counted = await readCountedAfterTriggers(supabase, inserted.id)
  return { success: true, error: null, counted }
}

export async function officerCheckIn(eventId: string, _semesterId: string, memberId: string) {
  const supabase = await createActionSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.', counted: false }

  const { data: officer } = await supabase
    .from('members')
    .select('id, role')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!officer || !['officer', 'admin'].includes(officer.role)) {
    return { success: false, error: 'Officer access required.', counted: false }
  }

  const { data: event } = await supabase
    .from('events')
    .select('scope, jt_family_id, semester_id')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    return { success: false, error: 'Event not found.', counted: false }
  }

  const { data: member } = await supabase
    .from('members')
    .select('jt_family_id')
    .eq('id', memberId)
    .maybeSingle()

  if (!member) {
    return { success: false, error: 'Member not found.', counted: false }
  }

  if (event.scope === 'jt_specific' && event.jt_family_id) {
    if (member.jt_family_id !== event.jt_family_id) {
      return {
        success: false,
        error: 'Only members in this Jiating can be checked in to this event.',
        counted: false,
      }
    }
  }

  if (event.scope === 'jt_shared') {
    const { data: linkedFamilies } = await supabase
      .from('event_jt_families')
      .select('jt_family_id')
      .eq('event_id', eventId)

    if (linkedFamilies && linkedFamilies.length > 0) {
      const allowed = new Set(linkedFamilies.map(row => row.jt_family_id))
      if (!member.jt_family_id || !allowed.has(member.jt_family_id)) {
        return {
          success: false,
          error: 'Only members in the participating Jiatings can be checked in to this event.',
          counted: false,
        }
      }
    } else if (!member.jt_family_id) {
      return {
        success: false,
        error: 'Only members assigned to a Jiating can be checked in to this event.',
        counted: false,
      }
    }
  }

  const { data: inserted, error } = await supabase.from('attendance').insert({
    member_id: memberId,
    event_id: eventId,
    semester_id: event.semester_id,
    check_in_method: 'officer',
    recorded_by: officer.id,
  }).select('id').single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Member already checked in.', counted: false }
    }
    return { success: false, error: 'Check-in failed. Please try again.', counted: false }
  }

  const counted = await readCountedAfterTriggers(supabase, inserted.id)
  return { success: true, error: null, counted }
}

export async function officerRemoveCheckIn(eventId: string, memberId: string) {
  const supabase = await createActionSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const { data: officer } = await supabase
    .from('members')
    .select('id, role')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!officer || !['officer', 'admin'].includes(officer.role)) {
    return { success: false, error: 'Officer access required.' }
  }

  const { data: removed, error } = await supabase
    .from('attendance')
    .delete()
    .eq('event_id', eventId)
    .eq('member_id', memberId)
    .select('id')
    .maybeSingle()

  if (error) {
    return { success: false, error: 'Failed to remove check-in. Please try again.' }
  }

  if (!removed) {
    return { success: false, error: 'No check-in record found.' }
  }

  return { success: true, error: null }
}
