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
