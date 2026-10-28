import { type calendar_v3, google } from "googleapis";
import { SPECTATOR_EVENT_CATEGORY } from "@/utils/events";

const TIME_ZONE = "America/Chicago";

/** Categories that publish to the shared CSA Member Calendar. Jiating Event and Jiating Mixer use per-Jiating calendars instead. */
const GOOGLE_CALENDAR_SYNC_CATEGORIES = new Set([
  "General Meeting",
  "CSA-Wide",
  "CSA-Wide Mixers",
  "Profit Share",
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

function isAuthConfigured(): boolean {
  if (process.env.GOOGLE_CALENDAR_SYNC_ENABLED !== "true") return false;
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  );
}

/** Service account can write calendars. Used by the member calendar and Jiating calendars. */
export function isGoogleCalendarSyncEnabled(): boolean {
  return isAuthConfigured();
}

function getCalendarClient(): calendar_v3.Calendar | null {
  if (!isAuthConfigured()) return null;

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

/**
 * An explicit calendar id is used as-is (blank skips).
 * Omitting it targets the shared member calendar in GOOGLE_CALENDAR_ID.
 */
function resolveCalendarId(calendarId?: string | null): string | null {
  if (calendarId !== undefined) {
    return calendarId?.trim() || null;
  }
  return process.env.GOOGLE_CALENDAR_ID?.trim() || null;
}

export function isMissingGoogleCalendarEvent(message: string): boolean {
  return /404|not found|Resource has been deleted/i.test(message);
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
  calendarId?: string | null,
): Promise<CalendarSyncResult> {
  const calendar = getCalendarClient();
  const id = resolveCalendarId(calendarId);
  if (!calendar || !id) {
    return { ok: true, googleEventId: null, skipped: true };
  }

  try {
    const response = await calendar.events.insert({
      calendarId: id,
      requestBody: toCalendarEventBody(payload),
    });
    const googleEventId = response.data.id;
    if (!googleEventId) {
      return {
        ok: false,
        error: "Google Calendar returned no event id.",
        skipped: false,
      };
    }
    return { ok: true, googleEventId, skipped: false };
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
  calendarId?: string | null,
): Promise<CalendarSyncResult> {
  const calendar = getCalendarClient();
  const id = resolveCalendarId(calendarId);
  if (!calendar || !id) {
    return { ok: true, googleEventId, skipped: true };
  }

  try {
    await calendar.events.patch({
      calendarId: id,
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
  calendarId?: string | null,
): Promise<CalendarSyncResult> {
  if (!googleEventId) {
    return { ok: true, googleEventId: null, skipped: true };
  }

  const calendar = getCalendarClient();
  const id = resolveCalendarId(calendarId);
  if (!calendar || !id) {
    return { ok: true, googleEventId, skipped: true };
  }

  try {
    await calendar.events.delete({
      calendarId: id,
      eventId: googleEventId,
    });
    return { ok: true, googleEventId: null, skipped: false };
  } catch (err) {
    // Already deleted on Google is fine.
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingGoogleCalendarEvent(message)) {
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
