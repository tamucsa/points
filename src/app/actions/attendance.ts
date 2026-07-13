'use server'

import { createActionSupabase } from '@/utils/supabase/action'

export async function selfCheckIn(eventId: string, semesterId: string) {
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

  const { data: inserted, error } = await supabase
    .from('attendance')
    .insert({
      member_id: member.id,
      event_id: eventId,
      semester_id: semesterId,
      check_in_method: 'qr_scan',
    })
    .select('counted')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'You have already checked in to this event.', counted: false }
    }
    return { success: false, error: 'Check-in failed. Please try again or ask an officer.', counted: false }
  }

  return { success: true, error: null, counted: inserted?.counted ?? true }
}

export async function officerCheckIn(eventId: string, semesterId: string, memberId: string) {
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

  const { data: event } = await supabase
    .from('events')
    .select('scope, jt_family_id')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    return { success: false, error: 'Event not found.' }
  }

  const { data: member } = await supabase
    .from('members')
    .select('jt_family_id')
    .eq('id', memberId)
    .maybeSingle()

  if (!member) {
    return { success: false, error: 'Member not found.' }
  }

  if (event.scope === 'jt_specific' && event.jt_family_id) {
    if (member.jt_family_id !== event.jt_family_id) {
      return {
        success: false,
        error: 'Only members in this Jiating can be checked in to this event.',
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
        }
      }
    } else if (!member.jt_family_id) {
      return {
        success: false,
        error: 'Only members assigned to a Jiating can be checked in to this event.',
      }
    }
  }

  const { error } = await supabase.from('attendance').insert({
    member_id: memberId,
    event_id: eventId,
    semester_id: semesterId,
    check_in_method: 'officer',
    recorded_by: officer.id,
  })

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Member already checked in.' }
    }
    return { success: false, error: 'Check-in failed. Please try again.' }
  }

  return { success: true, error: null }
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
