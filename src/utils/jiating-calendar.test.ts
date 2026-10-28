import { describe, expect, it } from "vitest";
import {
  jiatingCalendarFamilyIds,
  jiatingCalendarSyncNotice,
  parseGoogleCalendarId,
  planJiatingCalendarSync,
} from "@/utils/jiating-calendar";

const calendarA = "jt-a@group.calendar.google.com";
const calendarB = "jt-b@group.calendar.google.com";

describe("parseGoogleCalendarId", () => {
  it("clears a blank value", () => {
    expect(parseGoogleCalendarId("  ")).toEqual({
      ok: true,
      calendarId: null,
    });
  });

  it("keeps a calendar id", () => {
    expect(parseGoogleCalendarId(`  ${calendarA}  `)).toEqual({
      ok: true,
      calendarId: calendarA,
    });
  });

  it("rejects a share link", () => {
    const result = parseGoogleCalendarId(
      "https://calendar.google.com/calendar/embed?src=abc",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects spaces", () => {
    const result = parseGoogleCalendarId("not a calendar id");
    expect(result.ok).toBe(false);
  });
});

describe("jiatingCalendarFamilyIds", () => {
  it("sends a published Jiating Event to its one family", () => {
    expect(
      jiatingCalendarFamilyIds({
        category: "Jiating Event",
        publishStatus: "published",
        jtFamilyId: "jt-1",
        mixerFamilyIds: [],
      }),
    ).toEqual(["jt-1"]);
  });

  it("sends a published Mixer to each participating family", () => {
    expect(
      jiatingCalendarFamilyIds({
        category: "Jiating Mixer",
        publishStatus: "published",
        jtFamilyId: null,
        mixerFamilyIds: ["jt-1", "jt-2", "jt-1"],
      }),
    ).toEqual(["jt-1", "jt-2"]);
  });

  it("leaves Jiating Olympics and drafts off Jiating calendars", () => {
    expect(
      jiatingCalendarFamilyIds({
        category: "Jiating Olympics",
        publishStatus: "published",
        jtFamilyId: null,
        mixerFamilyIds: [],
      }),
    ).toEqual([]);
    expect(
      jiatingCalendarFamilyIds({
        category: "Jiating Event",
        publishStatus: "draft",
        jtFamilyId: "jt-1",
        mixerFamilyIds: [],
      }),
    ).toEqual([]);
  });
});

describe("planJiatingCalendarSync", () => {
  it("creates, patches, and replaces without deleting the previous calendar", () => {
    const actions = planJiatingCalendarSync({
      participatingFamilyIds: ["jt-1", "jt-2", "jt-3"],
      targets: [
        { jtFamilyId: "jt-1", calendarId: calendarA },
        { jtFamilyId: "jt-2", calendarId: calendarB },
      ],
      existing: [
        {
          jtFamilyId: "jt-2",
          googleCalendarId: calendarA,
          googleEventId: "old-event",
        },
        {
          jtFamilyId: "jt-3",
          googleCalendarId: calendarA,
          googleEventId: "kept",
        },
      ],
    });

    expect(actions).toEqual([
      { type: "create", jtFamilyId: "jt-1", calendarId: calendarA },
      {
        type: "replace",
        jtFamilyId: "jt-2",
        calendarId: calendarB,
        previousCalendarId: calendarA,
        previousGoogleEventId: "old-event",
      },
    ]);
  });

  it("patches an event already on the current calendar", () => {
    expect(
      planJiatingCalendarSync({
        participatingFamilyIds: ["jt-1"],
        targets: [{ jtFamilyId: "jt-1", calendarId: calendarA }],
        existing: [
          {
            jtFamilyId: "jt-1",
            googleCalendarId: calendarA,
            googleEventId: "g-1",
          },
        ],
      }),
    ).toEqual([
      {
        type: "patch",
        jtFamilyId: "jt-1",
        calendarId: calendarA,
        googleEventId: "g-1",
      },
    ]);
  });

  it("deletes a copy when the family no longer participates", () => {
    expect(
      planJiatingCalendarSync({
        participatingFamilyIds: ["jt-1"],
        targets: [{ jtFamilyId: "jt-1", calendarId: calendarA }],
        existing: [
          {
            jtFamilyId: "jt-9",
            googleCalendarId: calendarB,
            googleEventId: "gone",
          },
        ],
      }),
    ).toEqual([
      { type: "create", jtFamilyId: "jt-1", calendarId: calendarA },
      {
        type: "delete",
        jtFamilyId: "jt-9",
        calendarId: calendarB,
        googleEventId: "gone",
      },
    ]);
  });
});

describe("jiatingCalendarSyncNotice", () => {
  it("explains a first backfill", () => {
    expect(
      jiatingCalendarSyncNotice({
        previousCalendarId: null,
        calendarId: calendarA,
        sync: { skipped: false, synced: 4, failed: 1 },
      }),
    ).toBe("Synced 4 published events; 1 could not be copied.");
  });

  it("keeps previous-calendar copies when the id changes", () => {
    expect(
      jiatingCalendarSyncNotice({
        previousCalendarId: calendarA,
        calendarId: calendarB,
        sync: { skipped: false, synced: 2, failed: 0 },
      }),
    ).toBe(
      "Synced 2 published events to the calendar. Events already on the previous calendar stay there.",
    );
  });

  it("says nothing when the calendar id is cleared", () => {
    expect(
      jiatingCalendarSyncNotice({
        previousCalendarId: calendarA,
        calendarId: null,
        sync: null,
      }),
    ).toBeNull();
  });
});
