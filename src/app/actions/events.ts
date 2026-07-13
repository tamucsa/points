'use server'

import { createActionSupabase } from '@/utils/supabase/action'
import {
  resolveCentralEventTimestamp,
  validateEventEndAfterStart,
} from '@/utils/event-times'
import {
  SPECTATOR_EVENT_CATEGORY,
  getCategoryConfig,
  isMixerCategory,
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
  /** Participating families for Mixer (and optionally other JT-shared events). */
  jtFamilyIds: string[]
  checkInType: string
  eventDate: string
  startTime: string
  endTime: string | null
  location: string
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

async function requireAdmin() {
  const supabase = await createActionSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, error: 'Not authenticated.' as const }

  const { data: member } = await supabase
    .from('members')
    .select('role')
    .eq('auth_uid', user.id)
    .maybeSingle()

  if (!member || member.role !== 'admin') {
    return { supabase, error: 'Admin access required.' as const }
  }

  return { supabase, error: null }
}

export async function deleteEvent(eventId: string) {
  if (!eventId) return { success: false, error: 'Event not found.' }

  const { supabase, error: authError } = await requireAdmin()
  if (authError) return { success: false, error: authError }

  const { error: childError } = await supabase
    .from('events')
    .delete()
    .eq('parent_event_id', eventId)

  if (childError) {
    return { success: false, error: 'Failed to delete linked spectator event.' }
  }

  const { error } = await supabase.from('events').delete().eq('id', eventId)

  if (error) {
    return { success: false, error: 'Failed to delete event. Please try again.' }
  }

  return { success: true, error: null }
}

export async function createEvent(input: CreateEventInput) {
  if (!input.name.trim()) return { success: false, error: 'Event name is required.' }
  if (!input.eventDate) return { success: false, error: 'Event date is required.' }
  if (!input.startTime) return { success: false, error: 'Start time is required.' }
  if (!input.location.trim()) return { success: false, error: 'Location is required.' }

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

  const mixerFamilyIds = [...new Set(input.jtFamilyIds.filter(Boolean))]
  if (isMixerCategory(input.category) && mixerFamilyIds.length < 2) {
    return { success: false, error: 'Select at least two Jiatings for a Mixer.' }
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
  const location = input.location.trim()

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
      location,
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

  if (isMixerCategory(input.category) && mixerFamilyIds.length > 0) {
    const { error: familiesError } = await supabase.from('event_jt_families').insert(
      mixerFamilyIds.map(jtFamilyId => ({
        event_id: event.id,
        jt_family_id: jtFamilyId,
      })),
    )

    if (familiesError) {
      await supabase.from('events').delete().eq('id', event.id)
      return { success: false, error: 'Failed to save Mixer families. Please try again.' }
    }
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
      location,
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

export async function updateEventMixerFamilies(eventId: string, jtFamilyIds: string[]) {
  if (!eventId) return { success: false, error: 'Event not found.' }

  const familyIds = [...new Set(jtFamilyIds.filter(Boolean))]
  if (familyIds.length < 2) {
    return { success: false, error: 'Select at least two Jiatings for a Mixer.' }
  }

  const { supabase, error: authError } = await requireOfficer()
  if (authError) return { success: false, error: authError }

  const { data: event } = await supabase
    .from('events')
    .select('id, category')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) return { success: false, error: 'Event not found.' }
  if (!isMixerCategory(event.category)) {
    return { success: false, error: 'Only Mixer events have participating families.' }
  }

  const { data: currentLinks } = await supabase
    .from('event_jt_families')
    .select('jt_family_id')
    .eq('event_id', eventId)

  const currentIds = new Set((currentLinks ?? []).map(row => row.jt_family_id))
  const nextIds = new Set(familyIds)
  const removedIds = [...currentIds].filter(id => !nextIds.has(id))

  if (removedIds.length > 0) {
    const { data: membersInRemoved } = await supabase
      .from('members')
      .select('id')
      .in('jt_family_id', removedIds)

    const memberIds = (membersInRemoved ?? []).map(m => m.id)
    if (memberIds.length > 0) {
      const { count, error: attendanceError } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .in('member_id', memberIds)

      if (attendanceError) {
        return { success: false, error: 'Failed to verify existing check-ins.' }
      }

      if ((count ?? 0) > 0) {
        return {
          success: false,
          error:
            'Cannot remove a Jiating that already has check-ins. Remove those check-ins first, or keep the family selected.',
        }
      }
    }
  }

  const { error: deleteError } = await supabase
    .from('event_jt_families')
    .delete()
    .eq('event_id', eventId)

  if (deleteError) {
    return { success: false, error: 'Failed to update Mixer families.' }
  }

  const { error: insertError } = await supabase.from('event_jt_families').insert(
    familyIds.map(jtFamilyId => ({
      event_id: eventId,
      jt_family_id: jtFamilyId,
    })),
  )

  if (insertError) {
    return { success: false, error: 'Failed to save Mixer families.' }
  }

  return { success: true, error: null }
}
