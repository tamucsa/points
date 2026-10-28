import { isMixerCategory } from "@/utils/events";
import {
  type CalendarEventPayload,
  createCalendarEvent,
  deleteCalendarEvent,
  isGoogleCalendarSyncEnabled,
  isMissingGoogleCalendarEvent,
  updateCalendarEvent,
} from "@/utils/google-calendar";
import {
  type JiatingCalendarSyncCounts,
  type JiatingCalendarSyncRow,
  jiatingCalendarFamilyIds,
  planJiatingCalendarSync,
} from "@/utils/jiating-calendar";
import { createAdminSupabase } from "@/utils/supabase/admin";

const EMPTY_COUNTS: JiatingCalendarSyncCounts = {
  skipped: false,
  synced: 0,
  failed: 0,
};

type SyncEventRow = {
  id: string;
  category: string;
  jt_family_id: string | null;
  parent_event_id: string | null;
  publish_status: string | null;
  name: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
};

function payloadFor(event: SyncEventRow): CalendarEventPayload {
  return {
    name: event.name,
    description: event.description,
    location: event.location ?? "",
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    appEventId: event.id,
  };
}

async function loadMixerFamilyIds(
  admin: ReturnType<typeof createAdminSupabase>,
  eventId: string,
): Promise<string[]> {
  const { data } = await admin
    .from("event_jt_families")
    .select("jt_family_id")
    .eq("event_id", eventId);
  return (data ?? []).map((row) => row.jt_family_id);
}

/** Push one published event onto each participating Jiating calendar. Failures stay on the sync row. */
export async function syncJiatingCalendars(
  eventId: string,
): Promise<JiatingCalendarSyncCounts> {
  try {
    return await syncJiatingCalendarsImpl(eventId);
  } catch (err) {
    console.error("Jiating calendar sync failed:", err);
    return { skipped: false, synced: 0, failed: 1 };
  }
}

async function syncJiatingCalendarsImpl(
  eventId: string,
): Promise<JiatingCalendarSyncCounts> {
  const admin = createAdminSupabase();
  const { data: event } = await admin
    .from("events")
    .select(
      "id, category, jt_family_id, parent_event_id, publish_status, name, description, location, starts_at, ends_at",
    )
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return EMPTY_COUNTS;

  const mixerFamilyIds = isMixerCategory(event.category)
    ? await loadMixerFamilyIds(admin, eventId)
    : [];
  const participatingFamilyIds = jiatingCalendarFamilyIds({
    category: event.category,
    publishStatus: event.publish_status,
    parentEventId: event.parent_event_id,
    jtFamilyId: event.jt_family_id,
    mixerFamilyIds,
  });

  const families =
    participatingFamilyIds.length > 0
      ? ((
          await admin
            .from("jt_families")
            .select("id, google_calendar_id")
            .in("id", participatingFamilyIds)
        ).data ?? [])
      : [];

  const targets = families.flatMap((family) => {
    const calendarId = family.google_calendar_id?.trim();
    if (!calendarId) return [];
    return [{ jtFamilyId: family.id, calendarId }];
  });

  const { data: existingRows } = await admin
    .from("event_jt_calendar_events")
    .select("jt_family_id, google_calendar_id, google_event_id")
    .eq("event_id", eventId);

  const existing: JiatingCalendarSyncRow[] = (existingRows ?? []).map(
    (row) => ({
      jtFamilyId: row.jt_family_id,
      googleCalendarId: row.google_calendar_id,
      googleEventId: row.google_event_id,
    }),
  );

  const actions = planJiatingCalendarSync({
    participatingFamilyIds,
    targets,
    existing,
  });
  if (actions.length === 0) return EMPTY_COUNTS;
  if (!isGoogleCalendarSyncEnabled()) {
    return { skipped: true, synced: 0, failed: 0 };
  }

  const payload = payloadFor(event);
  let failed = false;

  for (const action of actions) {
    if (action.type === "delete") {
      const removed = await removeCopy(admin, eventId, action);
      if (!removed) failed = true;
      continue;
    }

    if (action.type === "patch") {
      const patched = await updateCalendarEvent(
        action.googleEventId,
        payload,
        action.calendarId,
      );
      if (patched.ok && !patched.skipped) {
        const saved = await saveCopy(admin, eventId, {
          jtFamilyId: action.jtFamilyId,
          calendarId: action.calendarId,
          googleEventId: action.googleEventId,
          syncError: null,
        });
        if (!saved) failed = true;
        continue;
      }
      if (!patched.ok && isMissingGoogleCalendarEvent(patched.error)) {
        const created = await insertCopy(
          admin,
          eventId,
          action.jtFamilyId,
          action.calendarId,
          payload,
        );
        if (!created.ok) {
          failed = true;
          await saveCopy(admin, eventId, {
            jtFamilyId: action.jtFamilyId,
            calendarId: action.calendarId,
            googleEventId: null,
            syncError: created.error,
          });
        }
        continue;
      }
      await saveCopy(admin, eventId, {
        jtFamilyId: action.jtFamilyId,
        calendarId: action.calendarId,
        googleEventId: action.googleEventId,
        syncError: patched.ok
          ? "Google Calendar sync was skipped."
          : patched.error,
      });
      failed = true;
      continue;
    }

    const created = await insertCopy(
      admin,
      eventId,
      action.jtFamilyId,
      action.calendarId,
      payload,
    );
    if (!created.ok) {
      failed = true;
      if (action.type === "replace") {
        await saveCopy(admin, eventId, {
          jtFamilyId: action.jtFamilyId,
          calendarId: action.previousCalendarId,
          googleEventId: action.previousGoogleEventId,
          syncError: created.error,
        });
      } else {
        await saveCopy(admin, eventId, {
          jtFamilyId: action.jtFamilyId,
          calendarId: action.calendarId,
          googleEventId: null,
          syncError: created.error,
        });
      }
    }
  }

  return { skipped: false, synced: failed ? 0 : 1, failed: failed ? 1 : 0 };
}

/** Drop every Jiating-calendar copy before the app event row is deleted. */
export async function removeJiatingCalendarEvents(eventId: string) {
  try {
    const admin = createAdminSupabase();
    const { data: rows } = await admin
      .from("event_jt_calendar_events")
      .select("jt_family_id, google_calendar_id, google_event_id")
      .eq("event_id", eventId);

    if (!isGoogleCalendarSyncEnabled()) return;

    for (const row of rows ?? []) {
      if (!row.google_event_id) continue;
      await deleteCalendarEvent(row.google_event_id, row.google_calendar_id);
    }
    await admin
      .from("event_jt_calendar_events")
      .delete()
      .eq("event_id", eventId);
  } catch (err) {
    console.error("Jiating calendar delete failed:", err);
  }
}

/** Copy this family's already-published events onto its current calendar. */
export async function backfillJiatingCalendar(
  jtFamilyId: string,
): Promise<JiatingCalendarSyncCounts> {
  try {
    return await backfillJiatingCalendarImpl(jtFamilyId);
  } catch (err) {
    console.error("Jiating calendar backfill failed:", err);
    return { skipped: false, synced: 0, failed: 1 };
  }
}

async function backfillJiatingCalendarImpl(
  jtFamilyId: string,
): Promise<JiatingCalendarSyncCounts> {
  const admin = createAdminSupabase();
  const ids = new Set<string>();

  const { data: familyEvents } = await admin
    .from("events")
    .select("id")
    .eq("jt_family_id", jtFamilyId)
    .eq("category", "Jiating Event")
    .eq("publish_status", "published")
    .is("parent_event_id", null);

  for (const event of familyEvents ?? []) ids.add(event.id);

  const { data: links } = await admin
    .from("event_jt_families")
    .select("event_id")
    .eq("jt_family_id", jtFamilyId);
  const mixerIds = [...new Set((links ?? []).map((row) => row.event_id))];

  if (mixerIds.length > 0) {
    const { data: mixers } = await admin
      .from("events")
      .select("id, category, publish_status, parent_event_id")
      .in("id", mixerIds);
    for (const event of mixers ?? []) {
      if (event.publish_status !== "published" || event.parent_event_id) {
        continue;
      }
      if (!isMixerCategory(event.category)) continue;
      ids.add(event.id);
    }
  }

  if (ids.size === 0) return EMPTY_COUNTS;
  if (!isGoogleCalendarSyncEnabled()) {
    return { skipped: true, synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;
  for (const eventId of ids) {
    const result = await syncJiatingCalendars(eventId);
    if (result.skipped) return { skipped: true, synced, failed };
    if (result.failed > 0) failed += 1;
    else if (result.synced > 0) synced += 1;
  }
  return { skipped: false, synced, failed };
}

async function insertCopy(
  admin: ReturnType<typeof createAdminSupabase>,
  eventId: string,
  jtFamilyId: string,
  calendarId: string,
  payload: CalendarEventPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const created = await createCalendarEvent(payload, calendarId);
  if (created.skipped || !created.ok || !created.googleEventId) {
    return {
      ok: false,
      error: created.ok ? "Google Calendar sync was skipped." : created.error,
    };
  }
  const saved = await saveCopy(admin, eventId, {
    jtFamilyId,
    calendarId,
    googleEventId: created.googleEventId,
    syncError: null,
  });
  return saved
    ? { ok: true }
    : { ok: false, error: "Failed to record the calendar event." };
}

async function removeCopy(
  admin: ReturnType<typeof createAdminSupabase>,
  eventId: string,
  action: {
    jtFamilyId: string;
    calendarId: string;
    googleEventId: string | null;
  },
): Promise<boolean> {
  if (action.googleEventId) {
    const removed = await deleteCalendarEvent(
      action.googleEventId,
      action.calendarId,
    );
    if (!removed.ok) {
      await saveCopy(admin, eventId, {
        jtFamilyId: action.jtFamilyId,
        calendarId: action.calendarId,
        googleEventId: action.googleEventId,
        syncError: removed.error,
      });
      return false;
    }
  }
  const { error } = await admin
    .from("event_jt_calendar_events")
    .delete()
    .eq("event_id", eventId)
    .eq("jt_family_id", action.jtFamilyId);
  return !error;
}

async function saveCopy(
  admin: ReturnType<typeof createAdminSupabase>,
  eventId: string,
  input: {
    jtFamilyId: string;
    calendarId: string;
    googleEventId: string | null;
    syncError: string | null;
  },
): Promise<boolean> {
  const { error } = await admin.from("event_jt_calendar_events").upsert(
    {
      event_id: eventId,
      jt_family_id: input.jtFamilyId,
      google_calendar_id: input.calendarId,
      google_event_id: input.googleEventId,
      synced_at: input.syncError ? null : new Date().toISOString(),
      sync_error: input.syncError?.slice(0, 500) ?? null,
    },
    { onConflict: "event_id,jt_family_id" },
  );
  if (error) {
    console.error("Failed to save Jiating calendar sync row:", error.message);
  }
  return !error;
}
