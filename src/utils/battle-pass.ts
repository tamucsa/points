import { isOfficerRole, isParent, type MemberAccess } from "@/utils/members";

/** Default catalog inserted for every new semester. Keep the SQL seed in sync. */
export const DEFAULT_BATTLE_PASS_REWARDS = [
  { name: "CSA Sticker", pointsRequired: 20 },
  { name: "Free Boba", pointsRequired: 40 },
  { name: "Past Merch", pointsRequired: 50 },
  { name: "Pie an Officer/Parent", pointsRequired: 70 },
  { name: "Blindbox", pointsRequired: 90 },
] as const;

export interface BattlePassAudience {
  redeemMembers: boolean;
  redeemOfficers: boolean;
  redeemParents: boolean;
}

export interface BattlePassReward extends BattlePassAudience {
  id: string;
  name: string;
  pointsRequired: number;
}

/** Missing flags mean the original members-only catalog. */
export function battlePassAudience(
  reward: Partial<BattlePassAudience>,
): BattlePassAudience {
  return {
    redeemMembers: reward.redeemMembers ?? true,
    redeemOfficers: reward.redeemOfficers ?? false,
    redeemParents: reward.redeemParents ?? false,
  };
}

export function battlePassAudienceLabel(reward: Partial<BattlePassAudience>) {
  const audience = battlePassAudience(reward);
  const groups = [
    audience.redeemMembers ? "Members" : null,
    audience.redeemOfficers ? "Officers" : null,
    audience.redeemParents ? "Parents" : null,
  ].filter((group): group is string => group != null);
  if (groups.length === 0) return "No one can redeem this";
  return groups.join(", ");
}

export function canRedeemBattlePassReward(
  member: MemberAccess,
  reward: Partial<BattlePassAudience>,
): boolean {
  const audience = battlePassAudience(reward);
  if (audience.redeemMembers && member.role === "member" && !isParent(member)) {
    return true;
  }
  if (audience.redeemOfficers && isOfficerRole(member.role)) return true;
  if (audience.redeemParents && isParent(member)) return true;
  return false;
}

export interface BattlePassMemberInput {
  id: string;
  fullName: string;
  email: string;
  jtFamily: string | null;
  role: string;
  isParent?: boolean | null;
  totalPoints: number;
}

export interface BattlePassPickupInput {
  rewardId: string;
  memberId: string;
}

export interface BattlePassRewardCell {
  rewardId: string;
  name: string;
  pointsRequired: number;
  redeemable: boolean;
  eligible: boolean;
  pickedUp: boolean;
}

export interface BattlePassTrackingRow {
  id: string;
  fullName: string;
  email: string;
  jtFamily: string | null;
  totalPoints: number;
  rewards: BattlePassRewardCell[];
}

export interface BattlePassRewardSummary {
  id: string;
  name: string;
  pointsRequired: number;
  eligible: number;
  pickedUp: number;
}

export interface BattlePassProgressItem extends BattlePassReward {
  redeemable: boolean;
  eligible: boolean;
  pickedUp: boolean;
  pointsToGo: number;
}

export function mapBattlePassReward(row: {
  id: string;
  name: string;
  points_required: number;
  redeem_members: boolean;
  redeem_officers: boolean;
  redeem_parents: boolean;
}): BattlePassReward {
  return {
    id: row.id,
    name: row.name,
    pointsRequired: row.points_required,
    redeemMembers: row.redeem_members,
    redeemOfficers: row.redeem_officers,
    redeemParents: row.redeem_parents,
  };
}

export function sortBattlePassRewards<
  T extends { pointsRequired: number; name: string },
>(rewards: T[]): T[] {
  return [...rewards].sort(
    (a, b) =>
      a.pointsRequired - b.pointsRequired || a.name.localeCompare(b.name),
  );
}

export function memberCanPickUpReward(
  member: MemberAccess,
  totalPoints: number,
  reward: { pointsRequired: number } & Partial<BattlePassAudience>,
): boolean {
  return (
    canRedeemBattlePassReward(member, reward) &&
    totalPoints >= reward.pointsRequired
  );
}

/**
 * People who can redeem at least one reward, plus anyone with a recorded
 * pickup. Eligible means they can redeem it and their points meet the
 * threshold. A pickup stays even if points or the audience later change.
 */
export function compileBattlePassRows(
  members: BattlePassMemberInput[],
  rewards: BattlePassReward[],
  pickups: BattlePassPickupInput[],
): BattlePassTrackingRow[] {
  const ordered = sortBattlePassRewards(rewards);
  const picked = new Set(
    pickups.map((pickup) => `${pickup.memberId}:${pickup.rewardId}`),
  );
  const rows: BattlePassTrackingRow[] = [];

  for (const member of members) {
    const access = { role: member.role, is_parent: member.isParent };
    const rewardsForMember = ordered.map((reward) => {
      const redeemable = canRedeemBattlePassReward(access, reward);
      return {
        rewardId: reward.id,
        name: reward.name,
        pointsRequired: reward.pointsRequired,
        redeemable,
        eligible: redeemable && member.totalPoints >= reward.pointsRequired,
        pickedUp: picked.has(`${member.id}:${reward.id}`),
      };
    });
    if (
      !rewardsForMember.some((reward) => reward.redeemable || reward.pickedUp)
    )
      continue;
    rows.push({
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      jtFamily: member.jtFamily,
      totalPoints: member.totalPoints,
      rewards: rewardsForMember,
    });
  }

  rows.sort((a, b) => {
    const aOpen = a.rewards.some(
      (reward) => reward.eligible && !reward.pickedUp,
    );
    const bOpen = b.rewards.some(
      (reward) => reward.eligible && !reward.pickedUp,
    );
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.fullName.localeCompare(b.fullName);
  });

  return rows;
}

export function summarizeBattlePass(
  rewards: BattlePassReward[],
  rows: BattlePassTrackingRow[],
): BattlePassRewardSummary[] {
  return sortBattlePassRewards(rewards).map((reward) => {
    let eligible = 0;
    let pickedUp = 0;
    for (const row of rows) {
      const cell = row.rewards.find((item) => item.rewardId === reward.id);
      if (!cell) continue;
      if (cell.eligible) eligible += 1;
      if (cell.pickedUp) pickedUp += 1;
    }
    return {
      id: reward.id,
      name: reward.name,
      pointsRequired: reward.pointsRequired,
      eligible,
      pickedUp,
    };
  });
}

export function describeBattlePassProgress(
  points: number,
  rewards: BattlePassReward[],
  pickedUpRewardIds: Iterable<string>,
  member?: MemberAccess | null,
): {
  items: BattlePassProgressItem[];
  next: BattlePassProgressItem | null;
  reachedCount: number;
} {
  const picked = new Set(pickedUpRewardIds);
  const items = sortBattlePassRewards(rewards).map((reward) => {
    const redeemable = member
      ? canRedeemBattlePassReward(member, reward)
      : true;
    return {
      ...reward,
      redeemable,
      eligible: redeemable && points >= reward.pointsRequired,
      pickedUp: picked.has(reward.id),
      pointsToGo: Math.max(0, reward.pointsRequired - points),
    };
  });
  const next = items.find((item) => item.redeemable && !item.eligible) ?? null;
  return {
    items,
    next,
    reachedCount: items.filter((item) => item.eligible).length,
  };
}
