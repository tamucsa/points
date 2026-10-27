import { earnsRewards, type MemberAccess } from "@/utils/members";

/** Default catalog inserted for every new semester. Keep the SQL seed in sync. */
export const DEFAULT_BATTLE_PASS_REWARDS = [
  { name: "CSA Sticker", pointsRequired: 20 },
  { name: "Free Boba", pointsRequired: 40 },
  { name: "Past Merch", pointsRequired: 50 },
  { name: "Pie an Officer/Parent", pointsRequired: 70 },
  { name: "Blindbox", pointsRequired: 90 },
] as const;

export interface BattlePassReward {
  id: string;
  name: string;
  pointsRequired: number;
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
  eligible: boolean;
  pickedUp: boolean;
  pointsToGo: number;
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
  pointsRequired: number,
): boolean {
  return earnsRewards(member) && totalPoints >= pointsRequired;
}

/**
 * Active dues-paying members only. A reward is eligible when semester points
 * meet its threshold. A recorded pickup stays on the row even if points later
 * fall below that threshold.
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
    if (!earnsRewards({ role: member.role, is_parent: member.isParent }))
      continue;
    rows.push({
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      jtFamily: member.jtFamily,
      totalPoints: member.totalPoints,
      rewards: ordered.map((reward) => ({
        rewardId: reward.id,
        name: reward.name,
        pointsRequired: reward.pointsRequired,
        eligible: member.totalPoints >= reward.pointsRequired,
        pickedUp: picked.has(`${member.id}:${reward.id}`),
      })),
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
): {
  items: BattlePassProgressItem[];
  next: BattlePassProgressItem | null;
  reachedCount: number;
} {
  const picked = new Set(pickedUpRewardIds);
  const items = sortBattlePassRewards(rewards).map((reward) => ({
    ...reward,
    eligible: points >= reward.pointsRequired,
    pickedUp: picked.has(reward.id),
    pointsToGo: Math.max(0, reward.pointsRequired - points),
  }));
  const next = items.find((item) => !item.eligible) ?? null;
  return {
    items,
    next,
    reachedCount: items.filter((item) => item.eligible).length,
  };
}
