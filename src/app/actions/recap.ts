"use server";

import { isAllowedSchoolEmail } from "@/utils/email";
import { isGeneralMeetingCategory } from "@/utils/events";
import { lookupMembersByEmail, normalizeEmail } from "@/utils/member-lookup";
import { canAccessOfficerEvents } from "@/utils/members";
import {
  CSA_WIDE_EVENT_CATEGORY,
  compileGmRewardRows,
  GENERAL_MEETING_CATEGORY,
  type GmRewardMemberRow,
} from "@/utils/rewards";
import { setSentryUser, withServerAction } from "@/utils/sentry";
import { createActionSupabase } from "@/utils/supabase/action";
import { fetchAllPages } from "@/utils/supabase/fetchAll";

async function requireOfficer() {
  const supabase = await createActionSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: "Not authenticated." as const };

  const { data: member } = await supabase
    .from("members")
    .select("id, role, is_parent")
    .eq("auth_uid", user.id)
    .maybeSingle();

  if (!member || !canAccessOfficerEvents(member)) {
    return { supabase, error: "Officer access required." as const };
  }

  setSentryUser(member);
  return { supabase, member, error: null };
}

export interface GmRecapRow {
  id: string;
  email: string;
  full_name: string | null;
  member_id: string | null;
  is_guest: boolean;
  member_name: string | null;
}

export interface RecapQuizUploadRow {
  fullName: string;
  email: string;
}

async function assertGeneralMeeting(
  supabase: Awaited<ReturnType<typeof createActionSupabase>>,
  eventId: string,
) {
  const { data: event } = await supabase
    .from("events")
    .select("id, category")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return "Event not found.";
  if (!isGeneralMeetingCategory(event.category)) {
    return "Recap quizzes are only for General Meetings.";
  }
  return null;
}

export async function replaceGmRecapQuiz(
  eventId: string,
  rows: RecapQuizUploadRow[],
) {
  return withServerAction("replaceGmRecapQuiz", () =>
    replaceGmRecapQuizImpl(eventId, rows),
  );
}

async function replaceGmRecapQuizImpl(
  eventId: string,
  rows: RecapQuizUploadRow[],
) {
  const { supabase, error: authError } = await requireOfficer();
  if (authError) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      error: authError,
    };
  }

  const eventError = await assertGeneralMeeting(supabase, eventId);
  if (eventError) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped: 0,
      error: eventError,
    };
  }

  const seenEmail = new Set<string>();
  const candidates: { email: string; fullName: string }[] = [];
  let skipped = 0;

  for (const row of rows) {
    const email = normalizeEmail(row.email ?? "");
    if (!isAllowedSchoolEmail(email) || seenEmail.has(email)) {
      skipped += 1;
      continue;
    }
    seenEmail.add(email);
    candidates.push({ email, fullName: (row.fullName ?? "").trim() });
  }

  const { memberByEmail, error: lookupError } = await lookupMembersByEmail(
    supabase,
    candidates.map((row) => row.email),
  );
  if (lookupError) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped,
      error: lookupError,
    };
  }

  const seenMember = new Set<string>();
  const payload: {
    email: string;
    full_name: string | null;
    member_id: string | null;
  }[] = [];
  let matched = 0;
  let unmatched = 0;

  for (const row of candidates) {
    const memberId = memberByEmail.get(row.email) ?? null;
    if (memberId && seenMember.has(memberId)) {
      skipped += 1;
      continue;
    }
    if (memberId) {
      seenMember.add(memberId);
      matched += 1;
    } else {
      unmatched += 1;
    }
    payload.push({
      email: row.email,
      full_name: row.fullName || null,
      member_id: memberId,
    });
  }

  const { error } = await supabase.rpc("replace_gm_recap_quiz", {
    p_event_id: eventId,
    p_rows: payload,
  });

  if (error) {
    return {
      success: false as const,
      matched: 0,
      unmatched: 0,
      skipped,
      error: "Failed to save the recap quiz. No changes were saved.",
    };
  }

  return {
    success: true as const,
    matched,
    unmatched,
    skipped,
    error: null,
  };
}

export async function matchGmRecapRow(rowId: string, memberId: string) {
  return withServerAction("matchGmRecapRow", () =>
    matchGmRecapRowImpl(rowId, memberId),
  );
}

async function matchGmRecapRowImpl(rowId: string, memberId: string) {
  const { supabase, error: authError } = await requireOfficer();
  if (authError) return { success: false as const, error: authError };

  const { data: row } = await supabase
    .from("gm_recap_submissions")
    .select("id, event_id")
    .eq("id", rowId)
    .maybeSingle();

  if (!row) return { success: false as const, error: "Quiz row not found." };

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .maybeSingle();

  if (!member) return { success: false as const, error: "Member not found." };

  const { data: duplicate } = await supabase
    .from("gm_recap_submissions")
    .select("id")
    .eq("event_id", row.event_id)
    .eq("member_id", memberId)
    .neq("id", rowId)
    .maybeSingle();

  if (duplicate) {
    return {
      success: false as const,
      error: "That member is already on this recap quiz.",
    };
  }

  const { error } = await supabase
    .from("gm_recap_submissions")
    .update({ member_id: memberId, is_guest: false })
    .eq("id", rowId);

  if (error) {
    return { success: false as const, error: "Failed to match this row." };
  }

  return { success: true as const, error: null };
}

export async function dismissGmRecapRowAsGuest(rowId: string) {
  return withServerAction("dismissGmRecapRowAsGuest", () =>
    dismissGmRecapRowAsGuestImpl(rowId),
  );
}

async function dismissGmRecapRowAsGuestImpl(rowId: string) {
  const { supabase, error: authError } = await requireOfficer();
  if (authError) return { success: false as const, error: authError };

  const { error } = await supabase
    .from("gm_recap_submissions")
    .update({ member_id: null, is_guest: true })
    .eq("id", rowId);

  if (error) {
    return {
      success: false as const,
      error: "Failed to mark this row as a guest.",
    };
  }

  return { success: true as const, error: null };
}

export async function clearGmRecapQuiz(eventId: string) {
  return withServerAction("clearGmRecapQuiz", () =>
    clearGmRecapQuizImpl(eventId),
  );
}

async function clearGmRecapQuizImpl(eventId: string) {
  const { supabase, error: authError } = await requireOfficer();
  if (authError) return { success: false as const, error: authError };

  const eventError = await assertGeneralMeeting(supabase, eventId);
  if (eventError) return { success: false as const, error: eventError };

  const { error } = await supabase.rpc("replace_gm_recap_quiz", {
    p_event_id: eventId,
    p_rows: [],
  });

  if (error) {
    return {
      success: false as const,
      error: "Failed to clear the recap quiz.",
    };
  }

  return { success: true as const, error: null };
}

export async function loadGmRewardReport() {
  return withServerAction("loadGmRewardReport", () => loadGmRewardReportImpl());
}

async function loadGmRewardReportImpl(): Promise<{
  semesterName: string | null;
  rows: GmRewardMemberRow[];
  error: string | null;
}> {
  const { supabase, error: authError } = await requireOfficer();
  if (authError) {
    return { semesterName: null, rows: [], error: authError };
  }

  const { data: semester } = await supabase
    .from("semesters")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();
  if (!semester) {
    return {
      semesterName: null,
      rows: [],
      error: "No active semester.",
    };
  }

  const { data: rewardEvents, error: eventsError } = await supabase
    .from("events")
    .select("id, category")
    .eq("semester_id", semester.id)
    .in("category", [GENERAL_MEETING_CATEGORY, CSA_WIDE_EVENT_CATEGORY]);

  if (eventsError) {
    return {
      semesterName: semester.name,
      rows: [],
      error: "Failed to load events for this reward.",
    };
  }

  const categoryByEvent = new Map(
    (rewardEvents ?? []).map((event) => [
      event.id as string,
      event.category as string,
    ]),
  );
  const eventIds = [...categoryByEvent.keys()];

  const [membersResult, attendanceResult, recapResult] = await Promise.all([
    fetchAllPages<{
      id: string;
      full_name: string;
      email: string;
      role: string;
      is_parent: boolean | null;
      jt_families: { name: string } | { name: string }[] | null;
    }>((from, to) =>
      supabase
        .from("members")
        .select("id, full_name, email, role, is_parent, jt_families(name)")
        .eq("status", "active")
        .order("full_name")
        .range(from, to),
    ),
    eventIds.length === 0
      ? Promise.resolve({
          data: [] as { member_id: string; event_id: string }[],
          error: null,
        })
      : fetchAllPages<{ member_id: string; event_id: string }>((from, to) =>
          supabase
            .from("attendance")
            .select("member_id, event_id")
            .in("event_id", eventIds)
            .range(from, to),
        ),
    fetchAllPages<{ member_id: string; event_id: string }>((from, to) =>
      supabase
        .from("gm_recap_submissions")
        .select("member_id, event_id")
        .eq("semester_id", semester.id)
        .eq("is_guest", false)
        .not("member_id", "is", null)
        .range(from, to),
    ),
  ]);

  if (membersResult.error || attendanceResult.error || recapResult.error) {
    return {
      semesterName: semester.name,
      rows: [],
      error: "Failed to compile the reward list.",
    };
  }

  const rows = compileGmRewardRows(
    membersResult.data.map((member) => {
      const family = Array.isArray(member.jt_families)
        ? member.jt_families[0]
        : member.jt_families;
      return {
        id: member.id,
        fullName: member.full_name,
        email: member.email,
        jtFamily: family?.name ?? null,
        role: member.role,
        isParent: member.is_parent,
      };
    }),
    attendanceResult.data.map((row) => ({
      memberId: row.member_id,
      eventId: row.event_id,
      category: categoryByEvent.get(row.event_id) ?? "",
    })),
    recapResult.data.map((row) => ({
      memberId: row.member_id,
      eventId: row.event_id,
    })),
  );

  return { semesterName: semester.name, rows, error: null };
}
