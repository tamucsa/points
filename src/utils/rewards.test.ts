import { describe, expect, it } from "vitest";
import {
  buildGmRewardProgress,
  compileGmRewardRows,
  GM_REWARD_REQUIRED_CREDITS,
  gmRewardCsv,
  parseRecapQuizCsv,
} from "@/utils/rewards";

describe("parseRecapQuizCsv", () => {
  it("reads a Google Form export and skips non-school emails", () => {
    const csv = [
      "Timestamp,Email Address,Score,Full Name",
      "9/1/2026 18:02,Ada@TAMU.edu,10,Ada Lovelace",
      "9/1/2026 18:05,guest@gmail.com,8,Guest",
      "9/1/2026 18:06,ada@tamu.edu,10,Ada Again",
    ].join("\n");

    const parsed = parseRecapQuizCsv(csv);
    expect(parsed.rows).toEqual([
      { fullName: "Ada Lovelace", email: "ada@tamu.edu" },
    ]);
    expect(parsed.skipped).toBe(2);
  });

  it("accepts a name,email sheet without a header", () => {
    const parsed = parseRecapQuizCsv("Wei Li,wei@buc.blinn.edu\n");
    expect(parsed.rows).toEqual([
      { fullName: "Wei Li", email: "wei@buc.blinn.edu" },
    ]);
    expect(parsed.skipped).toBe(0);
  });
});

describe("compileGmRewardRows", () => {
  const members = [
    {
      id: "ada",
      fullName: "Ada Lovelace",
      email: "ada@tamu.edu",
      jtFamily: "Alpha",
      role: "member",
    },
    {
      id: "off",
      fullName: "Officer Kim",
      email: "kim@tamu.edu",
      jtFamily: "Alpha",
      role: "officer",
    },
    {
      id: "parent",
      fullName: "Parent Lee",
      email: "lee@tamu.edu",
      jtFamily: "Beta",
      role: "member",
      isParent: true,
    },
    {
      id: "bea",
      fullName: "Bea Yu",
      email: "bea@tamu.edu",
      jtFamily: null,
      role: "member",
    },
  ];

  it("requires 3 distinct GM credits and 1 CSA-Wide attendance", () => {
    const rows = compileGmRewardRows(
      members,
      [
        { memberId: "ada", eventId: "gm1", category: "General Meeting" },
        { memberId: "ada", eventId: "gm2", category: "General Meeting" },
        { memberId: "ada", eventId: "csa1", category: "CSA-Wide" },
        { memberId: "ada", eventId: "mix1", category: "CSA-Wide Mixers" },
        { memberId: "bea", eventId: "gm1", category: "General Meeting" },
        { memberId: "bea", eventId: "gm2", category: "General Meeting" },
        { memberId: "bea", eventId: "gm3", category: "General Meeting" },
        { memberId: "off", eventId: "gm1", category: "General Meeting" },
        { memberId: "off", eventId: "gm2", category: "General Meeting" },
        { memberId: "off", eventId: "gm3", category: "General Meeting" },
        { memberId: "off", eventId: "csa1", category: "CSA-Wide" },
      ],
      [
        { memberId: "ada", eventId: "gm2" },
        { memberId: "ada", eventId: "gm3" },
        { memberId: "bea", eventId: "gm1" },
      ],
    );

    expect(GM_REWARD_REQUIRED_CREDITS).toBe(3);
    expect(rows.map((row) => row.id)).toEqual(["ada", "bea"]);
    expect(rows[0]).toMatchObject({
      id: "ada",
      gmCredits: 3,
      csaWideCount: 1,
      qualified: true,
    });
    expect(rows[1]).toMatchObject({
      id: "bea",
      gmCredits: 3,
      csaWideCount: 0,
      qualified: false,
    });
  });
});

describe("buildGmRewardProgress", () => {
  it("counts a quiz-only meeting as credit and keeps check-in points separate", () => {
    const progress = buildGmRewardProgress({
      attendance: [
        {
          eventId: "gm1",
          name: "GM 1",
          category: "General Meeting",
          startsAt: "2026-09-01T00:00:00Z",
        },
        {
          eventId: "csa1",
          name: "Banquet",
          category: "CSA-Wide",
          startsAt: "2026-09-10T00:00:00Z",
        },
      ],
      recapMeetings: [
        {
          eventId: "gm1",
          name: "GM 1",
          startsAt: "2026-09-01T00:00:00Z",
        },
        {
          eventId: "gm2",
          name: "GM 2",
          startsAt: "2026-09-15T00:00:00Z",
        },
      ],
    });

    expect(progress.gmCredits).toBe(2);
    expect(progress.csaWideCount).toBe(1);
    expect(progress.qualified).toBe(false);
    expect(progress.meetings.map((meeting) => meeting.via)).toEqual([
      "both",
      "quiz",
    ]);
  });
});

describe("gmRewardCsv", () => {
  it("quotes names that contain commas", () => {
    const csv = gmRewardCsv([
      {
        id: "1",
        fullName: "Li, Wei",
        email: "wei@tamu.edu",
        jtFamily: "Alpha",
        gmCredits: 3,
        csaWideCount: 1,
        qualified: true,
      },
    ]);
    expect(csv).toContain('"Li, Wei",wei@tamu.edu,Alpha,3,1,Yes');
  });
});
