import { redirect } from "next/navigation";
import MemberRewardsView from "@/app/(dashboard)/rewards/components/MemberRewardsView";
import {
  canRedeemBattlePassReward,
  describeBattlePassProgress,
  mapBattlePassReward,
  sortBattlePassRewards,
} from "@/utils/battle-pass";
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

  const [rewardsResult, pointsResult, pickupsResult] = await Promise.all([
    supabase
      .from("battle_pass_rewards")
      .select(
        "id, name, points_required, redeem_members, redeem_officers, redeem_parents",
      )
      .eq("semester_id", semester.id)
      .order("points_required")
      .order("name"),
    supabase
      .from("member_semester_points")
      .select("total_points")
      .eq("member_id", member.id)
      .eq("semester_id", semester.id)
      .maybeSingle(),
    supabase
      .from("battle_pass_pickups")
      .select("reward_id")
      .eq("member_id", member.id),
  ]);

  const rewards = sortBattlePassRewards(
    (rewardsResult.error ? [] : (rewardsResult.data ?? [])).map((reward) =>
      mapBattlePassReward(reward),
    ),
  );
  const showProgress =
    !rewardsResult.error &&
    rewards.some((reward) => canRedeemBattlePassReward(member, reward));
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
        showProgress && !pointsResult.error
          ? describeBattlePassProgress(points, rewards, pickedUpIds, member)
          : null
      }
      points={showProgress ? points : null}
      loadError={loadError}
    />
  );
}
