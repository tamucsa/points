'use server'

import { createActionSupabase } from '@/utils/supabase/action'
import {
  resolveCentralEventTimestamp,
  validateEventEndAfterStart,
} from '@/utils/event-times'
import {
  SPECTATOR_EVENT_CATEGORY,
  getCategoryConfig,
  isSportsCategory,
  type CheckInType,
} from '@/utils/events'

export interface CreateEventInput {
  semesterId: string
  name: string
  category: string
  pointValue: number
  scope: string
  jtFamilyId: string | null
  checkInType: string
  eventDate: string
  startTime: string
  endTime: string | null
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
  if (!input.startTime) return { success: false, error: 'Start time is required.' }

  const config = getCategoryConfig(input.category)
  if (!config) return { success: false, error: 'Invalid event category.' }

  const pointValue = config.pointValue
  const scope = config.scope
  const checkInType: CheckInType = config.checkInType
    ?? (['officer', 'self', 'rsvp_required'].includes(input.checkInType)
      ? (input.checkInType as CheckInType)
      : 'officer')

  if (scope === 'jt_specific' && !input.jtFamilyId) {
    return { success: false, error: 'JT family is required for JT-specific events.' }
  }

  const { supabase, error: authError } = await requireOfficer()
  if (authError) return { success: false, error: authError }

  const { value: startsAt, error: startError } = await resolveCentralEventTimestamp(
    supabase,
    input.eventDate,
    input.startTime,
  )
  if (!startsAt) return { success: false, error: startError ?? 'Invalid start time.' }

  let endsAt: string | null = null
  if (input.endTime) {
    const { value, error: endError } = await resolveCentralEventTimestamp(
      supabase,
      input.eventDate,
      input.endTime,
    )
    if (!value) return { success: false, error: endError ?? 'Invalid end time.' }
    if (!validateEventEndAfterStart(startsAt, value)) {
      return { success: false, error: 'End time must be after start time.' }
    }
    endsAt = value
  }

  const isRSVP = checkInType === 'rsvp_required'
  const isJTSpecific = scope === 'jt_specific'
  const hasSpectators = config.allowSpectators === true && input.hasSpectators

  const { data: event, error: eventError } = await supabase
    .from('events')
    .insert({
      semester_id: input.semesterId,
      name: input.name.trim(),
      category: input.category,
      point_value: pointValue,
      scope,
      jt_family_id: isJTSpecific ? input.jtFamilyId : null,
      check_in_type: checkInType,
      starts_at: startsAt,
      ends_at: endsAt,
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

  if (isSportsCategory(input.category) && hasSpectators) {
    const { error: spectatorError } = await supabase.from('events').insert({
      semester_id: input.semesterId,
      name: `${input.name.trim()} — Spectator`,
      category: SPECTATOR_EVENT_CATEGORY,
      point_value: 1,
      scope,
      jt_family_id: isJTSpecific ? input.jtFamilyId : null,
      check_in_type: 'self',
      starts_at: startsAt,
      ends_at: endsAt,
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

export async function updateEventRsvp(
  eventId: string,
  rsvpUrl: string | null,
  rsvpDeadline: string | null,
) {
  const { supabase, error: authError } = await requireOfficer()
  if (authError) return { success: false, error: authError }

  const { data: event } = await supabase
    .from('events')
    .select('id, check_in_type')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) return { success: false, error: 'Event not found.' }
  if (event.check_in_type !== 'rsvp_required') {
    return { success: false, error: 'This event does not use RSVP check-in.' }
  }

  const { error } = await supabase
    .from('events')
    .update({
      rsvp_url: rsvpUrl?.trim() || null,
      rsvp_deadline: rsvpDeadline || null,
    })
    .eq('id', eventId)

  if (error) return { success: false, error: 'Failed to save RSVP details.' }
  return { success: true, error: null }
}
