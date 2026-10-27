import { redirect } from "next/navigation";
import MemberRewardsView from "@/app/(dashboard)/rewards/components/MemberRewardsView";
import {
  type BattlePassReward,
  describeBattlePassProgress,
  sortBattlePassRewards,
} from "@/utils/battle-pass";
import { earnsRewards } from "@/utils/members";
import { getActiveSemester, getCurrentMember } from "@/utils/supabase/auth";

export default async function RewardsPage() {
  const [{ supabase, user, member }, semester] = await Promise.all([
    getCurrentMember(),
    getActiveSemester(),
  ]);

  if (!user) redirect("/");
  if (!member) redirect("/");

  if (!semester) {
    return (
      <MemberRewardsView
        semesterName={null}
        rewards={[]}
        progress={null}
        points={null}
        loadError={null}
      />
    );
  }

  const showProgress = earnsRewards(member);
  const [rewardsResult, pointsResult, pickupsResult] = await Promise.all([
    supabase
      .from("battle_pass_rewards")
      .select("id, name, points_required")
      .eq("semester_id", semester.id)
      .order("points_required")
      .order("name"),
    showProgress
      ? supabase
          .from("member_semester_points")
          .select("total_points")
          .eq("member_id", member.id)
          .eq("semester_id", semester.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    showProgress
      ? supabase
          .from("battle_pass_pickups")
          .select("reward_id")
          .eq("member_id", member.id)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const rewards: BattlePassReward[] = sortBattlePassRewards(
    (rewardsResult.error ? [] : (rewardsResult.data ?? [])).map((reward) => ({
      id: reward.id,
      name: reward.name,
      pointsRequired: reward.points_required,
    })),
  );
  const points = pointsResult.data?.total_points ?? 0;
  const pickedUpIds = (
    pickupsResult.error ? [] : (pickupsResult.data ?? [])
  ).map((row) => row.reward_id as string);
  const loadError = rewardsResult.error
    ? "Battle pass rewards could not be loaded."
    : pointsResult.error
      ? "Your points could not be loaded, so unlock status may be missing."
      : pickupsResult.error
        ? "Pickup status could not be loaded."
        : null;

  return (
    <MemberRewardsView
      semesterName={semester.name}
      rewards={rewards}
      progress={
        showProgress && !rewardsResult.error && !pointsResult.error
          ? describeBattlePassProgress(points, rewards, pickedUpIds)
          : null
      }
      points={showProgress ? points : null}
      loadError={loadError}
    />
  );
}
