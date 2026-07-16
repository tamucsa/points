"use server";

import {
  resolveCentralEventTimestamp,
  validateEventEndAfterStart,
} from "@/utils/event-times";
import {
  type CheckInType,
  getCategoryConfig,
  isMixerCategory,
  isSportsCategory,
  SPECTATOR_EVENT_CATEGORY,
} from "@/utils/events";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  shouldSyncEventToGoogleCalendar,
  syncErrorFields,
  syncSuccessFields,
  updateCalendarEvent,
} from "@/utils/google-calendar";
import { createActionSupabase } from "@/utils/supabase/action";

export type EventPublishMode = "draft" | "publish" | "schedule";
export type EventPublishStatus = "draft" | "scheduled" | "published";

export interface CreateEventInput {
  semesterId: string;
  name: string;
  category: string;
  pointValue: number;
  scope: string;
  jtFamilyId: string | null;
  /** Participating families for Mixer (and optionally other JT-shared events). */
  jtFamilyIds: string[];
  checkInType: string;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  location: string;
  /** Google Maps URI when location came from Places; null for free text. */
  locationMapsUrl?: string | null;
  description: string | null;
  rsvpUrl: string | null;
  rsvpDeadline: string | null;
  createdBy: string;
  hasSpectators: boolean;
  /** draft | publish now | schedule for later (America/Chicago). */
  publishMode: EventPublishMode;
  /** Required when publishMode is schedule (HTML date input, Chicago calendar day). */
  scheduleDate?: string | null;
  /** Required when publishMode is schedule (HTML time input, Chicago wall clock). */
  scheduleTime?: string | null;
}

async function syncCalendarAfterPublish(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  event: {
    id: string;
    category: string;
    name: string;
    description: string | null;
    location: string | null;
    starts_at: string;
    ends_at: string | null;
    rsvp_url: string | null;
    google_event_id: string | null;
    parent_event_id?: string | null;
  },
) {
  if (
    !shouldSyncEventToGoogleCalendar(event.category, event.parent_event_id)
  ) {
    return;
  }

  if (event.google_event_id) {
    const sync = await updateCalendarEvent(event.google_event_id, {
      name: event.name,
      description: event.description,
      location: event.location ?? "",
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      rsvpUrl: event.rsvp_url,
      appEventId: event.id,
    });
    if (sync.ok && !sync.skipped) {
      await supabase
        .from("events")
        .update(syncSuccessFields(event.google_event_id))
        .eq("id", event.id);
    } else if (!sync.ok) {
      await supabase
        .from("events")
        .update(syncErrorFields(sync.error))
        .eq("id", event.id);
    }
    return;
  }

  const sync = await createCalendarEvent({
    name: event.name,
    description: event.description,
    location: event.location ?? "",
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    rsvpUrl: event.rsvp_url,
    appEventId: event.id,
  });

  if (sync.ok && sync.googleEventId) {
    await supabase
      .from("events")
      .update(syncSuccessFields(sync.googleEventId))
      .eq("id", event.id);
  } else if (!sync.ok) {
    await supabase
      .from("events")
      .update(syncErrorFields(sync.error))
      .eq("id", event.id);
  }
}

/** Mark draft/scheduled event (and spectator child) published; sync Calendar if eligible. */
export async function publishEvent(eventId: string) {
  if (!eventId) return { success: false, error: "Event not found." };

  const { supabase, error: authError } = await requireOfficer();
  if (authError) return { success: false, error: authError };

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, category, name, description, location, starts_at, ends_at, rsvp_url, google_event_id, publish_status, parent_event_id",
    )
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { success: false, error: "Event not found." };
  if (event.parent_event_id) {
    return {
      success: false,
      error: "Publish the parent event instead of the spectator event.",
    };
  }
  if (event.publish_status === "published") {
    return { success: true, error: null };
  }

  const publishedAt = new Date().toISOString();
  const { error } = await supabase
    .from("events")
    .update({
      publish_status: "published",
      publish_at: null,
      published_at: publishedAt,
    })
    .eq("id", eventId);

  if (error) return { success: false, error: "Failed to publish event." };

  await supabase
    .from("events")
    .update({
      publish_status: "published",
      publish_at: null,
      published_at: publishedAt,
    })
    .eq("parent_event_id", eventId);

  await syncCalendarAfterPublish(supabase, event);
  return { success: true, error: null };
}

/** Used by cron: publish all scheduled events whose publish_at has passed. */
export async function publishDueScheduledEvents() {
  const { createAdminSupabase } = await import("@/utils/supabase/admin");
  const admin = createAdminSupabase();
  const now = new Date().toISOString();

  const { data: due, error } = await admin
    .from("events")
    .select(
      "id, category, name, description, location, starts_at, ends_at, rsvp_url, google_event_id, parent_event_id",
    )
    .eq("publish_status", "scheduled")
    .is("parent_event_id", null)
    .lte("publish_at", now);

  if (error) {
    return { success: false as const, error: error.message, published: 0 };
  }

  let published = 0;
  for (const event of due ?? []) {
    const publishedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("events")
      .update({
        publish_status: "published",
        publish_at: null,
        published_at: publishedAt,
      })
      .eq("id", event.id)
      .eq("publish_status", "scheduled");

    if (updateError) continue;

    await admin
      .from("events")
      .update({
        publish_status: "published",
        publish_at: null,
        published_at: publishedAt,
      })
      .eq("parent_event_id", event.id);

    await syncCalendarAfterPublish(admin, event);
    published += 1;
  }

  return { success: true as const, error: null, published };
}

async function requireOfficer() {
  const supabase = await createActionSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { supabase, error: "Not authenticated." as const, member: null };

  const { data: member } = await supabase
    .from("members")
    .select("id, role")
    .eq("auth_uid", user.id)
    .maybeSingle();

  if (!member || !["officer", "admin"].includes(member.role)) {
    return {
      supabase,
      error: "Officer access required." as const,
      member: null,
    };
  }

  return { supabase, error: null, member };
}

async function requireAdmin() {
  const supabase = await createActionSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not authenticated." as const };

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("auth_uid", user.id)
    .maybeSingle();

  if (!member || member.role !== "admin") {
    return { supabase, error: "Admin access required." as const };
  }

  return { supabase, error: null };
}

export async function deleteEvent(eventId: string) {
  if (!eventId) return { success: false, error: "Event not found." };

  const { supabase, error: authError } = await requireAdmin();
  if (authError) return { success: false, error: authError };

  const { data: existing } = await supabase
    .from("events")
    .select("id, google_event_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!existing) return { success: false, error: "Event not found." };

  // Soft-fail: Calendar delete errors do not block App delete.
  await deleteCalendarEvent(existing.google_event_id);

  const { error: childError } = await supabase
    .from("events")
    .delete()
    .eq("parent_event_id", eventId);

  if (childError) {
    return {
      success: false,
      error: "Failed to delete linked spectator event.",
    };
  }

  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) {
    return {
      success: false,
      error: "Failed to delete event. Please try again.",
    };
  }

  return { success: true, error: null };
}

export async function createEvent(input: CreateEventInput) {
  if (!input.name.trim())
    return { success: false, error: "Event name is required." };
  if (!input.eventDate)
    return { success: false, error: "Event date is required." };
  if (!input.startTime)
    return { success: false, error: "Start time is required." };
  if (!input.location.trim())
    return { success: false, error: "Location is required." };

  const config = getCategoryConfig(input.category);
  if (!config) return { success: false, error: "Invalid event category." };

  const pointValue = config.pointValue;
  const scope = config.scope;
  const checkInType: CheckInType =
    config.checkInType ??
    (["officer", "self", "rsvp_required"].includes(input.checkInType)
      ? (input.checkInType as CheckInType)
      : "officer");

  if (scope === "jt_specific" && !input.jtFamilyId) {
    return {
      success: false,
      error: "JT family is required for JT-specific events.",
    };
  }

  const mixerFamilyIds = [...new Set(input.jtFamilyIds.filter(Boolean))];
  if (isMixerCategory(input.category) && mixerFamilyIds.length < 2) {
    return {
      success: false,
      error: "Select at least two Jiatings for a Mixer.",
    };
  }

  const { supabase, error: authError } = await requireOfficer();
  if (authError) return { success: false, error: authError };

  const { value: startsAt, error: startError } =
    await resolveCentralEventTimestamp(
      supabase,
      input.eventDate,
      input.startTime,
    );
  if (!startsAt)
    return { success: false, error: startError ?? "Invalid start time." };

  let endsAt: string | null = null;
  if (input.endTime) {
    const { value, error: endError } = await resolveCentralEventTimestamp(
      supabase,
      input.eventDate,
      input.endTime,
    );
    if (!value)
      return { success: false, error: endError ?? "Invalid end time." };
    if (!validateEventEndAfterStart(startsAt, value)) {
      return { success: false, error: "End time must be after start time." };
    }
    endsAt = value;
  }

  const isRSVP = checkInType === "rsvp_required";
  const isJTSpecific = scope === "jt_specific";
  const hasSpectators = config.allowSpectators === true && input.hasSpectators;
  const location = input.location.trim();
  const locationMapsUrl = input.locationMapsUrl?.trim() || null;
  const name = input.name.trim();
  const rsvpUrl = isRSVP ? input.rsvpUrl : null;

  const publishMode = input.publishMode;
  if (!["draft", "publish", "schedule"].includes(publishMode)) {
    return { success: false, error: "Invalid publish option." };
  }

  let publishStatus: EventPublishStatus = "draft";
  let publishAt: string | null = null;
  let publishedAt: string | null = null;

  if (publishMode === "publish") {
    publishStatus = "published";
    publishedAt = new Date().toISOString();
  } else if (publishMode === "schedule") {
    if (!input.scheduleDate || !input.scheduleTime) {
      return {
        success: false,
        error: "Schedule date and time are required (Central Time).",
      };
    }
    const { value: scheduledAt, error: scheduleError } =
      await resolveCentralEventTimestamp(
        supabase,
        input.scheduleDate,
        input.scheduleTime,
      );
    if (!scheduledAt) {
      return {
        success: false,
        error: scheduleError ?? "Invalid schedule date or time.",
      };
    }
    if (new Date(scheduledAt).getTime() <= Date.now()) {
      return {
        success: false,
        error: "Schedule time must be in the future (Central Time).",
      };
    }
    publishStatus = "scheduled";
    publishAt = scheduledAt;
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({
      semester_id: input.semesterId,
      name,
      category: input.category,
      point_value: pointValue,
      scope,
      jt_family_id: isJTSpecific ? input.jtFamilyId : null,
      check_in_type: checkInType,
      starts_at: startsAt,
      ends_at: endsAt,
      location,
      location_maps_url: locationMapsUrl,
      description: input.description,
      rsvp_url: rsvpUrl,
      rsvp_deadline: isRSVP ? input.rsvpDeadline : null,
      created_by: input.createdBy,
      publish_status: publishStatus,
      publish_at: publishAt,
      published_at: publishedAt,
    })
    .select("id")
    .single();

  if (eventError || !event) {
    return {
      success: false,
      error: "Failed to create event. Please try again.",
    };
  }

  if (isMixerCategory(input.category) && mixerFamilyIds.length > 0) {
    const { error: familiesError } = await supabase
      .from("event_jt_families")
      .insert(
        mixerFamilyIds.map((jtFamilyId) => ({
          event_id: event.id,
          jt_family_id: jtFamilyId,
        })),
      );

    if (familiesError) {
      await supabase.from("events").delete().eq("id", event.id);
      return {
        success: false,
        error: "Failed to save Mixer families. Please try again.",
      };
    }
  }

  if (isSportsCategory(input.category) && hasSpectators) {
    const { error: spectatorError } = await supabase.from("events").insert({
      semester_id: input.semesterId,
      name: `${name} — Spectator`,
      category: SPECTATOR_EVENT_CATEGORY,
      point_value: 1,
      scope,
      jt_family_id: isJTSpecific ? input.jtFamilyId : null,
      check_in_type: "self",
      starts_at: startsAt,
      ends_at: endsAt,
      location,
      location_maps_url: locationMapsUrl,
      created_by: input.createdBy,
      parent_event_id: event.id,
      publish_status: publishStatus,
      publish_at: publishAt,
      published_at: publishedAt,
    });

    if (spectatorError) {
      return {
        success: false,
        error: "Event created, but spectator check-in failed to save.",
      };
    }
  }

  // Calendar only on publish (never draft/scheduled). Mixer / JT Event still skipped by helper.
  if (publishStatus === "published") {
    await syncCalendarAfterPublish(supabase, {
      id: event.id,
      category: input.category,
      name,
      description: input.description,
      location,
      starts_at: startsAt,
      ends_at: endsAt,
      rsvp_url: rsvpUrl,
      google_event_id: null,
      parent_event_id: null,
    });
  }

  return { success: true, error: null };
}

export async function updateEventRsvp(
  eventId: string,
  rsvpUrl: string | null,
  rsvpDeadline: string | null,
) {
  const { supabase, error: authError } = await requireOfficer();
  if (authError) return { success: false, error: authError };

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, check_in_type, name, description, location, starts_at, ends_at, google_event_id",
    )
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { success: false, error: "Event not found." };
  if (event.check_in_type !== "rsvp_required") {
    return { success: false, error: "This event does not use RSVP check-in." };
  }

  const nextRsvpUrl = rsvpUrl?.trim() || null;

  const { error } = await supabase
    .from("events")
    .update({
      rsvp_url: nextRsvpUrl,
      rsvp_deadline: rsvpDeadline || null,
    })
    .eq("id", eventId);

  if (error) return { success: false, error: "Failed to save RSVP details." };

  // Sync whenever a Google id exists (covers legacy/mis-synced rows).
  if (event.google_event_id) {
    const sync = await updateCalendarEvent(event.google_event_id, {
      name: event.name,
      description: event.description,
      location: event.location,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      rsvpUrl: nextRsvpUrl,
      appEventId: event.id,
    });

    if (sync.ok && !sync.skipped) {
      await supabase
        .from("events")
        .update(syncSuccessFields(event.google_event_id))
        .eq("id", eventId);
    } else if (!sync.ok) {
      await supabase
        .from("events")
        .update(syncErrorFields(sync.error))
        .eq("id", eventId);
    }
  }

  return { success: true, error: null };
}

export async function updateEventSchedule(
  eventId: string,
  input: {
    name?: string;
    eventDate: string;
    startTime: string;
    endTime: string | null;
    location: string;
    locationMapsUrl?: string | null;
    description?: string | null;
  },
) {
  if (!eventId) return { success: false, error: "Event not found." };
  if (input.name !== undefined && !input.name.trim())
    return { success: false, error: "Event name is required." };
  if (!input.eventDate)
    return { success: false, error: "Event date is required." };
  if (!input.startTime)
    return { success: false, error: "Start time is required." };
  if (!input.location.trim())
    return { success: false, error: "Location is required." };

  const { supabase, error: authError } = await requireOfficer();
  if (authError) return { success: false, error: authError };

  const { data: event } = await supabase
    .from("events")
    .select("id, name, description, rsvp_url, google_event_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { success: false, error: "Event not found." };

  const { value: startsAt, error: startError } =
    await resolveCentralEventTimestamp(
      supabase,
      input.eventDate,
      input.startTime,
    );
  if (!startsAt)
    return { success: false, error: startError ?? "Invalid start time." };

  let endsAt: string | null = null;
  if (input.endTime) {
    const { value, error: endError } = await resolveCentralEventTimestamp(
      supabase,
      input.eventDate,
      input.endTime,
    );
    if (!value)
      return { success: false, error: endError ?? "Invalid end time." };
    if (!validateEventEndAfterStart(startsAt, value)) {
      return { success: false, error: "End time must be after start time." };
    }
    endsAt = value;
  }

  const location = input.location.trim();
  const locationMapsUrl = input.locationMapsUrl?.trim() || null;
  const description =
    input.description !== undefined
      ? input.description?.trim() || null
      : event.description;
  const name =
    input.name !== undefined ? input.name.trim() : event.name;
  const patch = {
    starts_at: startsAt,
    ends_at: endsAt,
    location,
    location_maps_url: locationMapsUrl,
    description,
  };

  const { error } = await supabase
    .from("events")
    .update({ ...patch, name })
    .eq("id", eventId);
  if (error) return { success: false, error: "Failed to save event details." };

  // Spectator child keeps the schedule/location but derives its own name.
  const { error: spectatorError } = await supabase
    .from("events")
    .update({ ...patch, name: `${name} — Spectator` })
    .eq("parent_event_id", eventId);

  if (spectatorError) {
    return {
      success: false,
      error: "Event updated, but linked spectator event failed to update.",
    };
  }

  // Sync whenever a Google id exists (covers legacy/mis-synced rows).
  if (event.google_event_id) {
    const sync = await updateCalendarEvent(event.google_event_id, {
      name,
      description,
      location,
      startsAt,
      endsAt,
      rsvpUrl: event.rsvp_url,
      appEventId: event.id,
    });

    if (sync.ok && !sync.skipped) {
      await supabase
        .from("events")
        .update(syncSuccessFields(event.google_event_id))
        .eq("id", eventId);
    } else if (!sync.ok) {
      await supabase
        .from("events")
        .update(syncErrorFields(sync.error))
        .eq("id", eventId);
    }
  }

  return { success: true, error: null };
}

export async function updateEventMixerFamilies(
  eventId: string,
  jtFamilyIds: string[],
) {
  if (!eventId) return { success: false, error: "Event not found." };

  const familyIds = [...new Set(jtFamilyIds.filter(Boolean))];
  if (familyIds.length < 2) {
    return {
      success: false,
      error: "Select at least two Jiatings for a Mixer.",
    };
  }

  const { supabase, error: authError } = await requireOfficer();
  if (authError) return { success: false, error: authError };

  const { data: event } = await supabase
    .from("events")
    .select("id, category")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { success: false, error: "Event not found." };
  if (!isMixerCategory(event.category)) {
    return {
      success: false,
      error: "Only Mixer events have participating families.",
    };
  }

  const { data: currentLinks } = await supabase
    .from("event_jt_families")
    .select("jt_family_id")
    .eq("event_id", eventId);

  const currentIds = new Set(
    (currentLinks ?? []).map((row) => row.jt_family_id),
  );
  const nextIds = new Set(familyIds);
  const removedIds = [...currentIds].filter((id) => !nextIds.has(id));

  if (removedIds.length > 0) {
    const { data: membersInRemoved } = await supabase
      .from("members")
      .select("id")
      .in("jt_family_id", removedIds);

    const memberIds = (membersInRemoved ?? []).map((m) => m.id);
    if (memberIds.length > 0) {
      const { count, error: attendanceError } = await supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("event_id", eventId)
        .in("member_id", memberIds);

      if (attendanceError) {
        return {
          success: false,
          error: "Failed to verify existing check-ins.",
        };
      }

      if ((count ?? 0) > 0) {
        return {
          success: false,
          error:
            "Cannot remove a Jiating that already has check-ins. Remove those check-ins first, or keep the family selected.",
        };
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("event_jt_families")
    .delete()
    .eq("event_id", eventId);

  if (deleteError) {
    return { success: false, error: "Failed to update Mixer families." };
  }

  const { error: insertError } = await supabase
    .from("event_jt_families")
    .insert(
      familyIds.map((jtFamilyId) => ({
        event_id: eventId,
        jt_family_id: jtFamilyId,
      })),
    );

  if (insertError) {
    return { success: false, error: "Failed to save Mixer families." };
  }

  return { success: true, error: null };
}
