"use server";

import { isGeneralMeetingCategory } from "@/utils/events";
import { setSentryUser, withServerAction } from "@/utils/sentry";
import { createActionSupabase } from "@/utils/supabase/action";
import { createAdminSupabase } from "@/utils/supabase/admin";

async function requireOfficer() {
  const supabase = await createActionSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return { supabase, member: null, error: "Not authenticated." as const };

  const { data: member } = await supabase
    .from("members")
    .select("id, role")
    .eq("auth_uid", user.id)
    .maybeSingle();

  if (!member || !["officer", "admin"].includes(member.role)) {
    return {
      supabase,
      member: null,
      error: "Officer access required." as const,
    };
  }

  setSentryUser(member);
  return { supabase, member, error: null };
}

export async function publishJiatingStandings(eventId: string) {
  return withServerAction("publishJiatingStandings", () =>
    publishJiatingStandingsImpl(eventId),
  );
}

async function publishJiatingStandingsImpl(eventId: string) {
  const { member, error: authError } = await requireOfficer();
  if (authError) return { success: false as const, error: authError };

  const admin = createAdminSupabase();

  const { data: event } = await admin
    .from("events")
    .select("id, name, category, semester_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return { success: false as const, error: "Event not found." };
  if (!isGeneralMeetingCategory(event.category)) {
    return {
      success: false as const,
      error: "Standings can only be published from a General Meeting event.",
    };
  }

  const { data: existing } = await admin
    .from("jt_leaderboard_snapshots")
    .select("id")
    .eq("source_event_id", eventId)
    .maybeSingle();

  if (existing) {
    return {
      success: false as const,
      error: "Standings were already published for this General Meeting.",
    };
  }

  const { data: standings, error: standingsError } = await admin
    .from("v_jt_leaderboard")
    .select(
      "jt_family, jt_color, member_count, total_points, avg_points_per_member",
    );

  if (standingsError || !standings?.length) {
    return {
      success: false as const,
      error: "Failed to read current Jiating standings.",
    };
  }

  const { data: jtFamilies } = await admin
    .from("jt_families")
    .select("id, name")
    .eq("is_active", true);

  const jtIdByName = new Map((jtFamilies ?? []).map((jt) => [jt.name, jt.id]));

  const ranked = [...standings].sort((a, b) => b.total_points - a.total_points);

  const { data: snapshot, error: snapshotError } = await admin
    .from("jt_leaderboard_snapshots")
    .insert({
      semester_id: event.semester_id,
      source_event_id: event.id,
      label: event.name,
      published_by: member!.id,
    })
    .select("id")
    .single();

  if (snapshotError || !snapshot) {
    return {
      success: false as const,
      error: "Failed to save standings snapshot.",
    };
  }

  const rows = ranked.map((row, index) => ({
    snapshot_id: snapshot.id,
    jt_family_id: jtIdByName.get(row.jt_family) ?? null,
    jt_family_name: row.jt_family,
    jt_color: row.jt_color,
    member_count: row.member_count,
    total_points: row.total_points,
    avg_points_per_member: row.avg_points_per_member,
    rank: index + 1,
  }));

  const { error: rowsError } = await admin
    .from("jt_leaderboard_snapshot_rows")
    .insert(rows);

  if (rowsError) {
    await admin.from("jt_leaderboard_snapshots").delete().eq("id", snapshot.id);
    return {
      success: false as const,
      error: "Failed to save Jiating standings rows.",
    };
  }

  return { success: true as const, error: null, snapshotId: snapshot.id };
}

export async function getSnapshotForEvent(eventId: string) {
  return withServerAction("getSnapshotForEvent", () =>
    getSnapshotForEventImpl(eventId),
  );
}

async function getSnapshotForEventImpl(eventId: string) {
  const { supabase, error } = await requireOfficer();
  if (error) return null;

  const { data } = await supabase
    .from("jt_leaderboard_snapshots")
    .select("id, snapshot_at, label")
    .eq("source_event_id", eventId)
    .maybeSingle();

  return data;
}
