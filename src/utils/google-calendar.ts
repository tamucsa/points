import { type calendar_v3, google } from "googleapis";
import { SPECTATOR_EVENT_CATEGORY } from "@/utils/events";

const TIME_ZONE = "America/Chicago";

/** Categories that publish to the shared CSA Member Calendar. */
const GOOGLE_CALENDAR_SYNC_CATEGORIES = new Set([
  "General Meeting",
  "CSA-Wide",
  "CSA-Wide Mixers",
  "Howdy Week",
  "Jiating Olympics",
  "Sports",
  "Philanthropy",
  "Dance",
  "Concessions",
]);

export type CalendarEventPayload = {
  name: string;
  description: string | null;
  location: string;
  startsAt: string;
  endsAt: string | null;
  rsvpUrl?: string | null;
  appEventId: string;
};

export function shouldSyncEventToGoogleCalendar(
  category: string,
  parentEventId?: string | null,
  checkInType?: string | null,
): boolean {
  if (parentEventId) return false;
  // Monetary / manual-points awards are not calendar events.
  if (checkInType === "manual_points") return false;
  const trimmed = category.trim();
  if (trimmed === SPECTATOR_EVENT_CATEGORY) return false;
  return GOOGLE_CALENDAR_SYNC_CATEGORIES.has(trimmed);
}

function isSyncConfigured(): boolean {
  if (process.env.GOOGLE_CALENDAR_SYNC_ENABLED !== "true") return false;
  return Boolean(
    process.env.GOOGLE_CALENDAR_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

function getCalendarClient(): calendar_v3.Calendar | null {
  if (!isSyncConfigured()) return null;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !rawKey) return null;

  const auth = new google.auth.JWT({
    email,
    key: rawKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
}

function getCalendarId(): string | null {
  return process.env.GOOGLE_CALENDAR_ID ?? null;
}

function toCalendarEventBody(
  payload: CalendarEventPayload,
): calendar_v3.Schema$Event {
  const startMs = Date.parse(payload.startsAt);
  const endIso =
    payload.endsAt ?? new Date(startMs + 60 * 60 * 1000).toISOString();

  const description = payload.description?.trim() || undefined;

  return {
    summary: payload.name,
    description,
    location: payload.location,
    start: {
      dateTime: payload.startsAt,
      timeZone: TIME_ZONE,
    },
    end: {
      dateTime: endIso,
      timeZone: TIME_ZONE,
    },
  };
}

export type CalendarSyncResult =
  | { ok: true; googleEventId: string | null; skipped: boolean }
  | { ok: false; error: string; skipped: boolean };

/** Insert a Calendar event. No-ops when sync is disabled/unconfigured. */
export async function createCalendarEvent(
  payload: CalendarEventPayload,
): Promise<CalendarSyncResult> {
  const calendar = getCalendarClient();
  const calendarId = getCalendarId();
  if (!calendar || !calendarId) {
    return { ok: true, googleEventId: null, skipped: true };
  }

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: toCalendarEventBody(payload),
    });
    const id = response.data.id;
    if (!id) {
      return {
        ok: false,
        error: "Google Calendar returned no event id.",
        skipped: false,
      };
    }
    return { ok: true, googleEventId: id, skipped: false };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to create Google Calendar event.",
      skipped: false,
    };
  }
}

/** Patch an existing Calendar event. No-ops when sync is disabled/unconfigured. */
export async function updateCalendarEvent(
  googleEventId: string,
  payload: CalendarEventPayload,
): Promise<CalendarSyncResult> {
  const calendar = getCalendarClient();
  const calendarId = getCalendarId();
  if (!calendar || !calendarId) {
    return { ok: true, googleEventId, skipped: true };
  }

  try {
    await calendar.events.patch({
      calendarId,
      eventId: googleEventId,
      requestBody: toCalendarEventBody(payload),
    });
    return { ok: true, googleEventId, skipped: false };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to update Google Calendar event.",
      skipped: false,
    };
  }
}

/** Delete a Calendar event. No-ops when sync is disabled/unconfigured or id is missing. */
export async function deleteCalendarEvent(
  googleEventId: string | null | undefined,
): Promise<CalendarSyncResult> {
  if (!googleEventId) {
    return { ok: true, googleEventId: null, skipped: true };
  }

  const calendar = getCalendarClient();
  const calendarId = getCalendarId();
  if (!calendar || !calendarId) {
    return { ok: true, googleEventId, skipped: true };
  }

  try {
    await calendar.events.delete({
      calendarId,
      eventId: googleEventId,
    });
    return { ok: true, googleEventId: null, skipped: false };
  } catch (err) {
    // Already deleted on Google is fine.
    const message = err instanceof Error ? err.message : String(err);
    if (/404|not found|Resource has been deleted/i.test(message)) {
      return { ok: true, googleEventId: null, skipped: false };
    }
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to delete Google Calendar event.",
      skipped: false,
    };
  }
}

export function syncSuccessFields(googleEventId: string) {
  return {
    google_event_id: googleEventId,
    google_synced_at: new Date().toISOString(),
    google_sync_error: null as string | null,
  };
}

export function syncErrorFields(error: string) {
  return {
    google_sync_error: error.slice(0, 500),
  };
}
