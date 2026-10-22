import { splitCsvLine } from "@/utils/csv";
import { isAllowedSchoolEmail } from "@/utils/email";
import { normalizeEmail } from "@/utils/member-lookup";
import { earnsRewards, type MemberAccess } from "@/utils/members";

/** Credit for this many distinct General Meetings (check-in or recap quiz). */
export const GM_REWARD_REQUIRED_CREDITS = 3;

/** Attendance at this many events in the CSA-Wide category. */
export const GM_REWARD_REQUIRED_CSA_WIDE = 1;

export const GENERAL_MEETING_CATEGORY = "General Meeting";
export const CSA_WIDE_EVENT_CATEGORY = "CSA-Wide";

export interface RecapQuizCsvRow {
  fullName: string;
  email: string;
}

export interface GmRewardMemberInput {
  id: string;
  fullName: string;
  email: string;
  jtFamily: string | null;
  role: string;
  isParent?: boolean | null;
}

export interface GmRewardMemberRow {
  id: string;
  fullName: string;
  email: string;
  jtFamily: string | null;
  gmCredits: number;
  csaWideCount: number;
  qualified: boolean;
}

export interface GmMeetingCredit {
  eventId: string;
  name: string;
  startsAt: string | null;
  via: "attendance" | "quiz" | "both";
}

export interface GmRewardProgress {
  gmCredits: number;
  csaWideCount: number;
  qualified: boolean;
  meetings: GmMeetingCredit[];
  csaWideEvents: { eventId: string; name: string; startsAt: string | null }[];
}

function addId(map: Map<string, Set<string>>, key: string, id: string) {
  const set = map.get(key) ?? new Set<string>();
  set.add(id);
  map.set(key, set);
}

/**
 * Google Form / spreadsheet export. Uses Email and Name columns when present.
 * Rows outside @tamu.edu and @buc.blinn.edu are skipped. Duplicate emails keep
 * the first row.
 */
export function parseRecapQuizCsv(text: string): {
  rows: RecapQuizCsvRow[];
  skipped: number;
} {
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], skipped: 0 };

  const headers = splitCsvLine(lines[0]).map((header) => header.toLowerCase());
  const emailIdx = headers.findIndex((header) => header.includes("email"));
  const nameIdx = headers.findIndex(
    (header) =>
      header.includes("name") &&
      !header.includes("user") &&
      !header.includes("email"),
  );
  const hasHeader = emailIdx >= 0 || nameIdx >= 0;
  const start = hasHeader ? 1 : 0;

  const byEmail = new Map<string, RecapQuizCsvRow>();
  let skipped = 0;

  for (const line of lines.slice(start)) {
    const values = splitCsvLine(line);
    let fullName = "";
    let email = "";
    if (hasHeader) {
      fullName = nameIdx >= 0 ? (values[nameIdx] ?? "") : "";
      email = emailIdx >= 0 ? (values[emailIdx] ?? "") : "";
    } else if ((values[1] ?? "").includes("@")) {
      fullName = values[0] ?? "";
      email = values[1] ?? "";
    } else {
      email = values[0] ?? "";
    }

    const normalized = normalizeEmail(email);
    if (!isAllowedSchoolEmail(normalized) || byEmail.has(normalized)) {
      skipped += 1;
      continue;
    }

    byEmail.set(normalized, {
      fullName: fullName.trim(),
      email: normalized,
    });
  }

  return { rows: [...byEmail.values()], skipped };
}

export function memberQualifiesForGmReward(
  member: MemberAccess,
  gmCredits: number,
  csaWideCount: number,
): boolean {
  return (
    earnsRewards(member) &&
    gmCredits >= GM_REWARD_REQUIRED_CREDITS &&
    csaWideCount >= GM_REWARD_REQUIRED_CSA_WIDE
  );
}

/**
 * Active-semester reward list. Officers, admins, and parents are omitted.
 * A General Meeting counts once when the member checked in, submitted the
 * recap quiz, or both.
 */
export function compileGmRewardRows(
  members: GmRewardMemberInput[],
  attendance: { memberId: string; eventId: string; category: string }[],
  recap: { memberId: string; eventId: string }[],
): GmRewardMemberRow[] {
  const gmByMember = new Map<string, Set<string>>();
  const csaByMember = new Map<string, Set<string>>();

  for (const row of attendance) {
    if (row.category === GENERAL_MEETING_CATEGORY) {
      addId(gmByMember, row.memberId, row.eventId);
    } else if (row.category === CSA_WIDE_EVENT_CATEGORY) {
      addId(csaByMember, row.memberId, row.eventId);
    }
  }

  for (const row of recap) {
    addId(gmByMember, row.memberId, row.eventId);
  }

  const rows: GmRewardMemberRow[] = [];
  for (const member of members) {
    if (!earnsRewards({ role: member.role, is_parent: member.isParent }))
      continue;
    const gmCredits = gmByMember.get(member.id)?.size ?? 0;
    const csaWideCount = csaByMember.get(member.id)?.size ?? 0;
    rows.push({
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      jtFamily: member.jtFamily,
      gmCredits,
      csaWideCount,
      qualified: memberQualifiesForGmReward(
        { role: member.role, is_parent: member.isParent },
        gmCredits,
        csaWideCount,
      ),
    });
  }

  rows.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    if (b.gmCredits !== a.gmCredits) return b.gmCredits - a.gmCredits;
    if (b.csaWideCount !== a.csaWideCount)
      return b.csaWideCount - a.csaWideCount;
    return a.fullName.localeCompare(b.fullName);
  });

  return rows;
}

export function buildGmRewardProgress(input: {
  attendance: {
    eventId: string;
    name: string;
    category: string;
    startsAt?: string | null;
  }[];
  recapMeetings: { eventId: string; name: string; startsAt?: string | null }[];
}): GmRewardProgress {
  const gmAttendance = new Map<string, GmMeetingCredit>();
  const csaWide = new Map<
    string,
    { eventId: string; name: string; startsAt: string | null }
  >();

  for (const row of input.attendance) {
    if (!row.eventId) continue;
    if (row.category === GENERAL_MEETING_CATEGORY) {
      gmAttendance.set(row.eventId, {
        eventId: row.eventId,
        name: row.name || "General Meeting",
        startsAt: row.startsAt ?? null,
        via: "attendance",
      });
    } else if (
      row.category === CSA_WIDE_EVENT_CATEGORY &&
      !csaWide.has(row.eventId)
    ) {
      csaWide.set(row.eventId, {
        eventId: row.eventId,
        name: row.name || "CSA-Wide",
        startsAt: row.startsAt ?? null,
      });
    }
  }

  const meetings = new Map(gmAttendance);
  for (const quiz of input.recapMeetings) {
    if (!quiz.eventId) continue;
    const existing = meetings.get(quiz.eventId);
    if (existing) {
      existing.via = "both";
      if (!existing.name && quiz.name) existing.name = quiz.name;
    } else {
      meetings.set(quiz.eventId, {
        eventId: quiz.eventId,
        name: quiz.name || "General Meeting",
        startsAt: quiz.startsAt ?? null,
        via: "quiz",
      });
    }
  }

  const meetingList = [...meetings.values()].sort(compareByStart);
  const csaWideEvents = [...csaWide.values()].sort(compareByStart);
  const gmCredits = meetingList.length;
  const csaWideCount = csaWideEvents.length;

  return {
    gmCredits,
    csaWideCount,
    qualified:
      gmCredits >= GM_REWARD_REQUIRED_CREDITS &&
      csaWideCount >= GM_REWARD_REQUIRED_CSA_WIDE,
    meetings: meetingList,
    csaWideEvents,
  };
}

function compareByStart(
  a: { startsAt: string | null; name: string },
  b: { startsAt: string | null; name: string },
) {
  const aTime = a.startsAt ?? "";
  const bTime = b.startsAt ?? "";
  if (aTime !== bTime) return aTime.localeCompare(bTime);
  return a.name.localeCompare(b.name);
}

export function gmRewardCsv(rows: GmRewardMemberRow[]): string {
  const header = [
    "Full Name",
    "Email",
    "Jiating",
    "GM Credits",
    "CSA-Wide Events",
    "Reached Reward",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.fullName,
        row.email,
        row.jtFamily ?? "",
        row.gmCredits,
        row.csaWideCount,
        row.qualified ? "Yes" : "No",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function gmCreditLabel(via: GmMeetingCredit["via"]): string {
  if (via === "quiz") return "Recap quiz";
  if (via === "both") return "Checked in and recap quiz";
  return "Checked in";
}
