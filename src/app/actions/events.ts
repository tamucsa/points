'use server'

import { createActionSupabase } from '@/utils/supabase/action'

export interface CreateEventInput {
  semesterId: string
  name: string
  category: string
  pointValue: number
  scope: string
  jtFamilyId: string | null
  checkInType: string
  eventDate: string
  location: string | null
  description: string | null
  rsvpUrl: string | null
  rsvpDeadline: string | null
  createdBy: string
  hasSpectators: boolean
}

async function requireOfficer() {
  const supabase = await createActionSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Not authenticated.' as const, member: null }

  const { data: member } = await supabase
    .from('members')
    .select('id, role')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!member || !['officer', 'admin'].includes(member.role)) {
    return { supabase, error: 'Officer access required.' as const, member: null }
  }

  return { supabase, error: null, member }
}

export async function createEvent(input: CreateEventInput) {
  if (!input.name.trim()) return { success: false, error: 'Event name is required.' }
  if (!input.eventDate) return { success: false, error: 'Event date is required.' }
  if (input.scope === 'jt_specific' && !input.jtFamilyId) {
    return { success: false, error: 'JT family is required for JT-specific events.' }
  }

  const { supabase, error: authError } = await requireOfficer()
  if (authError) return { success: false, error: authError }

  const isRSVP = input.checkInType === 'rsvp_required'
  const isJTSpecific = input.scope === 'jt_specific'

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      semester_id: input.semesterId,
      name: input.name.trim(),
      category: input.category,
      point_value: input.pointValue,
      scope: input.scope,
      jt_family_id: isJTSpecific ? input.jtFamilyId : null,
      check_in_type: input.checkInType,
      event_date: input.eventDate,
      location: input.location,
      description: input.description,
      rsvp_url: isRSVP ? input.rsvpUrl : null,
      rsvp_deadline: isRSVP ? input.rsvpDeadline : null,
      created_by: input.createdBy,
    })
    .select('id')
    .single()

  if (eventError || !event) {
    return { success: false, error: 'Failed to create event. Please try again.' }
  }

  if (input.category === 'Sports' && input.hasSpectators) {
    const { error: spectatorError } = await supabase.from('events').insert({
      semester_id: input.semesterId,
      name: `${input.name.trim()} — Spectator`,
      category: 'Sports Spectator',
      point_value: 1,
      scope: input.scope,
      jt_family_id: isJTSpecific ? input.jtFamilyId : null,
      check_in_type: 'self',
      event_date: input.eventDate,
      location: input.location,
      created_by: input.createdBy,
      parent_event_id: event.id,
    })

    if (spectatorError) {
      return { success: false, error: 'Event created, but spectator check-in failed to save.' }
    }
  }

  return { success: true, error: null }
}
