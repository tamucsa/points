"use server";

import {
  type CultureQuizAssignment,
  type CultureQuizPlace,
  cultureQuizAssignmentError,
  isCultureQuizPlace,
} from "@/utils/culture-quiz";
import { isGeneralMeetingCategory } from "@/utils/events";
import { canAccessOfficerEvents, isParent } from "@/utils/members";
import { setSentryUser, withServerAction } from "@/utils/sentry";
import { createActionSupabase } from "@/utils/supabase/action";

const MEMBER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function linkedMember(value: unknown): {
  role?: string;
  is_parent?: boolean | null;
} | null {
  if (!value) return null;
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  return row as { role?: string; is_parent?: boolean | null };
}

function friendlyQuizError(message: string): string {
  if (message.includes("attendance list")) {
    return "Each place has to be someone who checked in to this meeting.";
  }
  if (message.includes("Parents cannot")) {
    return "Parents cannot earn Culture Quiz points.";
  }
  if (message.includes("one Culture Quiz place")) {
    return "A member can only hold one Culture Quiz place.";
  }
  if (message.includes("only for General Meetings")) {
    return "Culture Quiz results are only for General Meetings.";
  }
  if (message.includes("Officer access")) {
    return "Officer access required.";
  }
  return "Failed to save the Culture Quiz. No changes were saved.";
}

function parseAssignments(
  rows: { memberId: string; place: number }[],
): { assignments: CultureQuizAssignment[] } | { error: string } {
  const assignments: CultureQuizAssignment[] = [];
  for (const row of rows) {
    const memberId = (row.memberId ?? "").trim();
    if (!MEMBER_ID_RE.test(memberId) || !isCultureQuizPlace(row.place)) {
      return { error: "Each result needs a checked-in member and a place." };
    }
    assignments.push({ memberId, place: row.place as CultureQuizPlace });
  }
  const assignmentError = cultureQuizAssignmentError(assignments);
  if (assignmentError) return { error: assignmentError };
  return { assignments };
}

export async function replaceGmCultureQuiz(
  eventId: string,
  rows: { memberId: string; place: number }[],
) {
  return withServerAction("replaceGmCultureQuiz", () =>
    replaceGmCultureQuizImpl(eventId, rows),
  );
}

async function replaceGmCultureQuizImpl(
  eventId: string,
  rows: { memberId: string; place: number }[],
) {
  const { supabase, error: authError } = await requireOfficer();
  if (authError) return { success: false as const, error: authError };

  const parsed = parseAssignments(rows);
  if ("error" in parsed)
    return { success: false as const, error: parsed.error };

  const { data: event } = await supabase
    .from("events")
    .select("id, category")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { success: false as const, error: "Event not found." };
  if (!isGeneralMeetingCategory(event.category)) {
    return {
      success: false as const,
      error: "Culture Quiz results are only for General Meetings.",
    };
  }

  const { data: attendance, error: attendanceError } = await supabase
    .from("attendance")
    .select("member_id, members!attendance_member_id_fkey(role, is_parent)")
    .eq("event_id", eventId);

  if (attendanceError) {
    return {
      success: false as const,
      error: "Could not read this meeting's attendance.",
    };
  }

  const attended = new Map<
    string,
    { role?: string; is_parent?: boolean | null }
  >();
  for (const row of attendance ?? []) {
    attended.set(row.member_id, linkedMember(row.members) ?? {});
  }

  for (const assignment of parsed.assignments) {
    const member = attended.get(assignment.memberId);
    if (!member) {
      return {
        success: false as const,
        error: "Each place has to be someone who checked in to this meeting.",
      };
    }
    if (
      isParent({ role: member.role ?? "member", is_parent: member.is_parent })
    ) {
      return {
        success: false as const,
        error: "Parents cannot earn Culture Quiz points.",
      };
    }
  }

  const { error } = await supabase.rpc("replace_gm_culture_quiz", {
    p_event_id: eventId,
    p_rows: parsed.assignments.map((row) => ({
      member_id: row.memberId,
      place: row.place,
    })),
  });

  if (error) {
    return {
      success: false as const,
      error: friendlyQuizError(error.message),
    };
  }

  return { success: true as const, error: null };
}
