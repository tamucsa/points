"use server";

import { revalidatePath } from "next/cache";
import {
  type BattlePassReward,
  type BattlePassTrackingRow,
  compileBattlePassRows,
  sortBattlePassRewards,
} from "@/utils/battle-pass";
import { canAccessOfficerEvents } from "@/utils/members";
import { setSentryUser, withServerAction } from "@/utils/sentry";
import { createActionSupabase } from "@/utils/supabase/action";
import { createAdminSupabase } from "@/utils/supabase/admin";
import { fetchAllPages } from "@/utils/supabase/fetchAll";

const MAX_REWARDS_PER_SEMESTER = 20;

async function requireAdmin() {
  const supabase = await createActionSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." as const };

  const { data: member } = await supabase
    .from("members")
    .select("id, role")
    .eq("auth_uid", user.id)
    .maybeSingle();

  if (!member || member.role !== "admin") {
    return { error: "Admin access required." as const };
  }

  setSentryUser(member);
  return { error: null };
}

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

function parseRewardName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 80) return null;
  return name;
}

function parsePoints(value: number): number | null {
  if (!Number.isInteger(value) || value < 0 || value > 10000) return null;
  return value;
}

function rewardWriteError(
  error: { code?: string; message?: string } | null,
): string {
  if (error?.code === "23505") {
    return "A reward with that name already exists for this semester.";
  }
  if (error?.code === "23514") {
    return "Enter a reward name and a points value from 0 to 10000.";
  }
  return "Failed to save reward.";
}

function revalidateRewardSurfaces() {
  revalidatePath("/admin/semesters");
  revalidatePath("/rewards");
  revalidatePath("/officer/rewards/bp");
}

export async function createBattlePassReward(input: {
  semesterId: string;
  name: string;
  pointsRequired: number;
}) {
  return withServerAction("createBattlePassReward", () =>
    createBattlePassRewardImpl(input),
  );
}

async function createBattlePassRewardImpl(input: {
  semesterId: string;
  name: string;
  pointsRequired: number;
}) {
  const { error: authError } = await requireAdmin();
  if (authError)
    return { success: false as const, error: authError, reward: null };

  const name = parseRewardName(input.name);
  const pointsRequired = parsePoints(input.pointsRequired);
  if (!name || pointsRequired == null) {
    return {
      success: false as const,
      error: "Enter a reward name and a points value from 0 to 10000.",
      reward: null,
    };
  }

  const admin = createAdminSupabase();
  const { count, error: countError } = await admin
    .from("battle_pass_rewards")
    .select("id", { count: "exact", head: true })
    .eq("semester_id", input.semesterId);

  if (countError) {
    return {
      success: false as const,
      error: "Failed to save reward.",
      reward: null,
    };
  }
  if ((count ?? 0) >= MAX_REWARDS_PER_SEMESTER) {
    return {
      success: false as const,
      error: `A semester can have at most ${MAX_REWARDS_PER_SEMESTER} rewards.`,
      reward: null,
    };
  }

  const { data, error } = await admin
    .from("battle_pass_rewards")
    .insert({
      semester_id: input.semesterId,
      name,
      points_required: pointsRequired,
    })
    .select("id, name, points_required")
    .single();

  if (error || !data) {
    return {
      success: false as const,
      error: rewardWriteError(error),
      reward: null,
    };
  }

  revalidateRewardSurfaces();
  return {
    success: true as const,
    error: null,
    reward: {
      id: data.id as string,
      name: data.name as string,
      pointsRequired: data.points_required as number,
    } satisfies BattlePassReward,
  };
}

export async function updateBattlePassReward(input: {
  id: string;
  name: string;
  pointsRequired: number;
}) {
  return withServerAction("updateBattlePassReward", () =>
    updateBattlePassRewardImpl(input),
  );
}

async function updateBattlePassRewardImpl(input: {
  id: string;
  name: string;
  pointsRequired: number;
}) {
  const { error: authError } = await requireAdmin();
  if (authError) return { success: false as const, error: authError };

  const name = parseRewardName(input.name);
  const pointsRequired = parsePoints(input.pointsRequired);
  if (!name || pointsRequired == null) {
    return {
      success: false as const,
      error: "Enter a reward name and a points value from 0 to 10000.",
    };
  }

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("battle_pass_rewards")
    .update({ name, points_required: pointsRequired })
    .eq("id", input.id);

  if (error) return { success: false as const, error: rewardWriteError(error) };

  revalidateRewardSurfaces();
  return { success: true as const, error: null };
}

export async function deleteBattlePassReward(id: string) {
  return withServerAction("deleteBattlePassReward", () =>
    deleteBattlePassRewardImpl(id),
  );
}

async function deleteBattlePassRewardImpl(id: string) {
  const { error: authError } = await requireAdmin();
  if (authError) return { success: false as const, error: authError };

  const admin = createAdminSupabase();
  const { error } = await admin
    .from("battle_pass_rewards")
    .delete()
    .eq("id", id);
  if (error)
    return { success: false as const, error: "Failed to remove reward." };

  revalidateRewardSurfaces();
  return { success: true as const, error: null };
}

function pickupError(error: { message?: string } | null): string {
  const message = error?.message ?? "";
  if (message.includes("has not reached")) {
    return "This member has not reached this reward yet.";
  }
  if (message.includes("dues-paying")) {
    return "Only active dues-paying members can pick up battle pass rewards.";
  }
  if (message.includes("Officer access")) {
    return "Officer access required.";
  }
  return "Failed to update pickup.";
}

export async function setBattlePassPickup(input: {
  rewardId: string;
  memberId: string;
  pickedUp: boolean;
}) {
  return withServerAction("setBattlePassPickup", () =>
    setBattlePassPickupImpl(input),
  );
}

async function setBattlePassPickupImpl(input: {
  rewardId: string;
  memberId: string;
  pickedUp: boolean;
}) {
  const { supabase, error: authError } = await requireOfficer();
  if (authError) return { success: false as const, error: authError };

  if (input.pickedUp) {
    const { error } = await supabase.from("battle_pass_pickups").insert({
      reward_id: input.rewardId,
      member_id: input.memberId,
    });
    if (error && error.code !== "23505") {
      return { success: false as const, error: pickupError(error) };
    }
  } else {
    const { error } = await supabase
      .from("battle_pass_pickups")
      .delete()
      .eq("reward_id", input.rewardId)
      .eq("member_id", input.memberId);
    if (error)
      return { success: false as const, error: "Failed to update pickup." };
  }

  revalidatePath("/officer/rewards/bp");
  revalidatePath("/rewards");
  return { success: true as const, error: null };
}

export interface BattlePassTrackingReport {
  semesterName: string | null;
  rewards: BattlePassReward[];
  rows: BattlePassTrackingRow[];
  error: string | null;
}

export async function loadBattlePassTracking() {
  return withServerAction("loadBattlePassTracking", () =>
    loadBattlePassTrackingImpl(),
  );
}

async function loadBattlePassTrackingImpl(): Promise<BattlePassTrackingReport> {
  const empty: BattlePassTrackingReport = {
    semesterName: null,
    rewards: [],
    rows: [],
    error: null,
  };
  const { supabase, error: authError } = await requireOfficer();
  if (authError) return { ...empty, error: authError };

  const { data: semester } = await supabase
    .from("semesters")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();
  if (!semester) {
    return { ...empty, error: "No active semester." };
  }

  const { data: rewardRows, error: rewardsError } = await supabase
    .from("battle_pass_rewards")
    .select("id, name, points_required")
    .eq("semester_id", semester.id)
    .order("points_required")
    .order("name");

  if (rewardsError) {
    return {
      ...empty,
      semesterName: semester.name,
      error: "Failed to load battle pass rewards.",
    };
  }

  const rewards = sortBattlePassRewards(
    (rewardRows ?? []).map((reward) => ({
      id: reward.id as string,
      name: reward.name as string,
      pointsRequired: reward.points_required as number,
    })),
  );
  const rewardIds = rewards.map((reward) => reward.id);

  const [membersResult, pointsResult, pickupsResult] = await Promise.all([
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
    fetchAllPages<{ member_id: string; total_points: number }>((from, to) =>
      supabase
        .from("member_semester_points")
        .select("member_id, total_points")
        .eq("semester_id", semester.id)
        .range(from, to),
    ),
    rewardIds.length === 0
      ? Promise.resolve({
          data: [] as { reward_id: string; member_id: string }[],
          error: null,
        })
      : fetchAllPages<{ reward_id: string; member_id: string }>((from, to) =>
          supabase
            .from("battle_pass_pickups")
            .select("reward_id, member_id")
            .in("reward_id", rewardIds)
            .range(from, to),
        ),
  ]);

  if (membersResult.error || pointsResult.error || pickupsResult.error) {
    return {
      semesterName: semester.name,
      rewards,
      rows: [],
      error: "Failed to load battle pass tracking.",
    };
  }

  const pointsByMember = new Map(
    pointsResult.data.map((row) => [row.member_id, row.total_points]),
  );

  const rows = compileBattlePassRows(
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
        totalPoints: pointsByMember.get(member.id) ?? 0,
      };
    }),
    rewards,
    pickupsResult.data.map((pickup) => ({
      rewardId: pickup.reward_id,
      memberId: pickup.member_id,
    })),
  );

  return { semesterName: semester.name, rewards, rows, error: null };
}
