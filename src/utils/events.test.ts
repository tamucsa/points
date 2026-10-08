import { describe, expect, it } from "vitest";
import {
  checkInOptionLabel,
  eventMatchesFilter,
  eventMatchesJiatingFamily,
  eventParticipatingJiatings,
  showAddPointsPill,
  flexibleCheckInTypes,
  JIATING_MIXER_POINTS,
  JIATING_MIXER_SIX_WAY_POINTS,
  jiatingMixerPointValue,
  resolveEventCheckInType,
} from "@/utils/events";

const six = ["jt-1", "jt-2", "jt-3", "jt-4", "jt-5", "jt-6"];

describe("flexibleCheckInTypes", () => {
  it("lets CSA-Wide Mixers choose CSV, officer, QR, or RSVP", () => {
    expect(flexibleCheckInTypes("CSA-Wide Mixers")).toEqual([
      "csv_import",
      "officer",
      "self",
      "rsvp_required",
    ]);
  });

  it("keeps other flexible categories on officer, QR, and RSVP", () => {
    expect(flexibleCheckInTypes("CSA-Wide")).toEqual([
      "officer",
      "self",
      "rsvp_required",
    ]);
    expect(flexibleCheckInTypes("Philanthropy")).toEqual([
      "officer",
      "self",
      "rsvp_required",
      "manual_points",
    ]);
  });
});

describe("resolveEventCheckInType", () => {
  it("keeps a mixer choice and falls back to CSV import", () => {
    expect(resolveEventCheckInType("CSA-Wide Mixers", "self")).toBe("self");
    expect(resolveEventCheckInType("CSA-Wide Mixers", "manual_points")).toBe(
      "csv_import",
    );
  });

  it("uses the category's fixed check-in type", () => {
    expect(resolveEventCheckInType("General Meeting", "officer")).toBe("self");
    expect(resolveEventCheckInType("Howdy Week", "officer")).toBe("csv_import");
  });

  it("labels mixer QR and CSV check-in", () => {
    expect(checkInOptionLabel("CSA-Wide Mixers", "self")).toBe("QR Check-in");
    expect(checkInOptionLabel("CSA-Wide Mixers", "csv_import")).toBe(
      "CSV Import",
    );
    expect(checkInOptionLabel("CSA-Wide", "self")).toBe("Self Check-in");
  });
});

describe("jiatingMixerPointValue", () => {
  it("is 3 points when all 6 active Jiatings are selected", () => {
    expect(jiatingMixerPointValue(six, six)).toBe(JIATING_MIXER_SIX_WAY_POINTS);
  });

  it("is 2 points when any of the 6 is missing", () => {
    expect(jiatingMixerPointValue(six.slice(0, 5), six)).toBe(
      JIATING_MIXER_POINTS,
    );
    expect(jiatingMixerPointValue([], six)).toBe(JIATING_MIXER_POINTS);
  });

  it("stays 2 points unless there are exactly 6 active Jiatings", () => {
    expect(jiatingMixerPointValue(six.slice(0, 5), six.slice(0, 5))).toBe(
      JIATING_MIXER_POINTS,
    );
    expect(jiatingMixerPointValue([...six, "jt-7"], [...six, "jt-7"])).toBe(
      JIATING_MIXER_POINTS,
    );
  });
});

describe("event list filters", () => {
  const olympics = { category: "Jiating Olympics", scope: "jt_shared" };
  const mixer = { category: "Jiating Mixer", scope: "jt_shared" };
  const familyEvent = { category: "Jiating Event", scope: "jt_specific" };

  it("lists Jiating Olympics on their own tab", () => {
    expect(eventMatchesFilter(olympics, "olympics")).toBe(true);
    expect(eventMatchesFilter(olympics, "jiating")).toBe(false);
    expect(eventMatchesFilter(olympics, "csa")).toBe(false);
    expect(eventMatchesFilter(olympics, "all")).toBe(true);
  });

  it("keeps family events and mixers on the Jiating tab", () => {
    expect(eventMatchesFilter(familyEvent, "jiating")).toBe(true);
    expect(eventMatchesFilter(mixer, "jiating")).toBe(true);
    expect(eventMatchesFilter(familyEvent, "olympics")).toBe(false);
  });

  it("lists the one family on a Jiating Event and linked families on a Mixer", () => {
    const families = [
      { id: "jt-1", name: "Dimoo", color: "#111" },
      { id: "jt-2", name: "Smiski", color: "#222" },
    ];
    expect(
      eventParticipatingJiatings(
        { id: "e1", category: "Jiating Event", jt_family_id: "jt-2" },
        families,
        {},
      ).map((f) => f.name),
    ).toEqual(["Smiski"]);
    expect(
      eventParticipatingJiatings(
        { id: "e2", category: "Jiating Mixer", jt_family_id: null },
        families,
        { e2: ["jt-2", "jt-1"] },
      ).map((f) => f.name),
    ).toEqual(["Dimoo", "Smiski"]);
    expect(
      eventParticipatingJiatings(
        { id: "e3", category: "Jiating Olympics", jt_family_id: null },
        families,
        {},
      ),
    ).toEqual([]);
  });

  it("shows Add Points only when a published event still has no attendance or upload", () => {
    const base = {
      category: "Jiating Event",
      publishStatus: "published",
      attendanceCount: 0,
      hasImportUpload: false,
      hasRsvpUpload: false,
    };
    expect(showAddPointsPill(base)).toBe(true);
    expect(showAddPointsPill({ ...base, attendanceCount: 2 })).toBe(false);
    expect(showAddPointsPill({ ...base, hasImportUpload: true })).toBe(false);
    expect(showAddPointsPill({ ...base, category: "Howdy Week" })).toBe(false);
    expect(showAddPointsPill({ ...base, publishStatus: "draft" })).toBe(false);
  });

  it("does not count Jiating Olympics toward a Jiating family", () => {
    const event = {
      id: "olympics-1",
      category: "Jiating Olympics",
      scope: "jt_shared",
      jt_family_id: null,
    };
    expect(eventMatchesJiatingFamily(event, "jt-1", {})).toBe(false);
    expect(eventMatchesJiatingFamily(event, null, {})).toBe(true);
  });
});
