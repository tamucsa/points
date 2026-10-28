import { isMixerCategory } from "@/utils/events";

const CALENDAR_ID_MAX = 256;

export type JiatingCalendarTarget = {
  jtFamilyId: string;
  calendarId: string;
};

export type JiatingCalendarSyncRow = {
  jtFamilyId: string;
  googleCalendarId: string;
  googleEventId: string | null;
};

export type JiatingCalendarSyncAction =
  | { type: "create"; jtFamilyId: string; calendarId: string }
  | {
      type: "patch";
      jtFamilyId: string;
      calendarId: string;
      googleEventId: string;
    }
  | {
      type: "replace";
      jtFamilyId: string;
      calendarId: string;
      previousCalendarId: string;
      previousGoogleEventId: string | null;
    }
  | {
      type: "delete";
      jtFamilyId: string;
      calendarId: string;
      googleEventId: string | null;
    };

export type JiatingCalendarSyncCounts = {
  skipped: boolean;
  synced: number;
  failed: number;
};

/** Empty input clears the calendar. Links are rejected; sync needs the Calendar ID. */
export function parseGoogleCalendarId(
  raw: string,
): { ok: true; calendarId: string | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, calendarId: null };
  if (/^https?:\/\//i.test(trimmed)) {
    return {
      ok: false,
      error:
        "Paste the Calendar ID from Google Calendar settings (it looks like an email), not a link.",
    };
  }
  if (/\s/.test(trimmed)) {
    return { ok: false, error: "Calendar ID cannot contain spaces." };
  }
  if (trimmed.length > CALENDAR_ID_MAX) {
    return { ok: false, error: "Calendar ID is too long." };
  }
  return { ok: true, calendarId: trimmed };
}

/** Families that should carry this event on a Jiating calendar right now. */
export function jiatingCalendarFamilyIds(input: {
  category: string;
  publishStatus: string | null;
  parentEventId?: string | null;
  jtFamilyId?: string | null;
  mixerFamilyIds: readonly string[];
}): string[] {
  if (input.parentEventId) return [];
  if (input.publishStatus !== "published") return [];
  if (input.category.trim() === "Jiating Event") {
    return input.jtFamilyId ? [input.jtFamilyId] : [];
  }
  if (isMixerCategory(input.category)) {
    return [...new Set(input.mixerFamilyIds.filter(Boolean))];
  }
  return [];
}

/**
 * Decide Google writes for one app event.
 * A family that still participates but has no calendar ID keeps any existing copy untouched.
 * A changed calendar ID creates a new copy and leaves the previous calendar's event in place.
 * A family that no longer participates is removed from its calendar.
 */
export function planJiatingCalendarSync(input: {
  participatingFamilyIds: readonly string[];
  targets: readonly JiatingCalendarTarget[];
  existing: readonly JiatingCalendarSyncRow[];
}): JiatingCalendarSyncAction[] {
  const participating = new Set(input.participatingFamilyIds);
  const existingByFamily = new Map(
    input.existing.map((row) => [row.jtFamilyId, row]),
  );
  const actions: JiatingCalendarSyncAction[] = [];

  for (const target of input.targets) {
    if (!participating.has(target.jtFamilyId)) continue;
    const row = existingByFamily.get(target.jtFamilyId);
    if (!row) {
      actions.push({
        type: "create",
        jtFamilyId: target.jtFamilyId,
        calendarId: target.calendarId,
      });
      continue;
    }
    if (row.googleCalendarId !== target.calendarId) {
      actions.push({
        type: "replace",
        jtFamilyId: target.jtFamilyId,
        calendarId: target.calendarId,
        previousCalendarId: row.googleCalendarId,
        previousGoogleEventId: row.googleEventId,
      });
      continue;
    }
    if (row.googleEventId) {
      actions.push({
        type: "patch",
        jtFamilyId: target.jtFamilyId,
        calendarId: target.calendarId,
        googleEventId: row.googleEventId,
      });
      continue;
    }
    actions.push({
      type: "create",
      jtFamilyId: target.jtFamilyId,
      calendarId: target.calendarId,
    });
  }

  for (const row of input.existing) {
    if (participating.has(row.jtFamilyId)) continue;
    actions.push({
      type: "delete",
      jtFamilyId: row.jtFamilyId,
      calendarId: row.googleCalendarId,
      googleEventId: row.googleEventId,
    });
  }

  return actions;
}

/** Extra sentence for the admin toast after a Jiating calendar ID is saved. */
export function jiatingCalendarSyncNotice(input: {
  previousCalendarId: string | null;
  calendarId: string | null;
  sync: JiatingCalendarSyncCounts | null;
}): string | null {
  if (!input.calendarId) return null;
  const moved =
    Boolean(input.previousCalendarId) &&
    input.previousCalendarId !== input.calendarId;
  const stayed = moved
    ? " Events already on the previous calendar stay there."
    : "";
  if (!input.sync || input.sync.skipped) {
    return `Calendar ID saved. Google Calendar sync is turned off, so published events were not copied yet.${stayed}`;
  }
  if (input.sync.failed > 0) {
    return `Synced ${input.sync.synced} published event${input.sync.synced === 1 ? "" : "s"}; ${input.sync.failed} could not be copied.${stayed}`;
  }
  if (input.sync.synced === 0) {
    return moved ? `Events already on the previous calendar stay there.` : null;
  }
  return `Synced ${input.sync.synced} published event${input.sync.synced === 1 ? "" : "s"} to the calendar.${stayed}`;
}
