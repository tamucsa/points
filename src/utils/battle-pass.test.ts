import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type BattlePassReward,
  compileBattlePassRows,
  DEFAULT_BATTLE_PASS_REWARDS,
  describeBattlePassProgress,
  memberCanPickUpReward,
  summarizeBattlePass,
} from "@/utils/battle-pass";

const membersOnly = {
  redeemMembers: true,
  redeemOfficers: false,
  redeemParents: false,
} satisfies Pick<
  BattlePassReward,
  "redeemMembers" | "redeemOfficers" | "redeemParents"
>;

const rewards: BattlePassReward[] = [
  { id: "sticker", name: "CSA Sticker", pointsRequired: 20, ...membersOnly },
  { id: "boba", name: "Free Boba", pointsRequired: 40, ...membersOnly },
  { id: "merch", name: "Past Merch", pointsRequired: 50, ...membersOnly },
  {
    id: "pie",
    name: "Pie an Officer/Parent",
    pointsRequired: 70,
    ...membersOnly,
  },
  { id: "box", name: "Blindbox", pointsRequired: 90, ...membersOnly },
];

describe("DEFAULT_BATTLE_PASS_REWARDS", () => {
  it("matches the semester seed in the migration", () => {
    const sql = [
      readFileSync(
        resolve("supabase/migrations/20261026204513_battle_pass_rewards.sql"),
        "utf8",
      ),
      readFileSync(
        resolve(
          "supabase/migrations/20261027004649_parent_points_and_battle_pass_audience.sql",
        ),
        "utf8",
      ),
    ].join("\n");
    for (const reward of DEFAULT_BATTLE_PASS_REWARDS) {
      expect(sql).toContain(`'${reward.name}', ${reward.pointsRequired}`);
    }
  });
});

describe("compileBattlePassRows", () => {
  const members = [
    {
      id: "ada",
      fullName: "Ada Lovelace",
      email: "ada@tamu.edu",
      jtFamily: "Alpha",
      role: "member",
      totalPoints: 47,
    },
    {
      id: "bea",
      fullName: "Bea Yu",
      email: "bea@tamu.edu",
      jtFamily: null,
      role: "member",
      totalPoints: 90,
    },
    {
      id: "off",
      fullName: "Officer Kim",
      email: "kim@tamu.edu",
      jtFamily: "Alpha",
      role: "officer",
      totalPoints: 200,
    },
    {
      id: "parent",
      fullName: "Parent Lee",
      email: "lee@tamu.edu",
      jtFamily: "Beta",
      role: "member",
      isParent: true,
      totalPoints: 80,
    },
  ];

  it("keeps dues-paying members and marks rewards they have reached", () => {
    const rows = compileBattlePassRows(members, rewards, [
      { memberId: "ada", rewardId: "sticker" },
      { memberId: "bea", rewardId: "box" },
    ]);

    expect(rows.map((row) => row.id)).toEqual(["bea", "ada"]);
    const ada = rows.find((row) => row.id === "ada");
    expect(
      ada?.rewards.map((reward) => [
        reward.name,
        reward.eligible,
        reward.pickedUp,
      ]),
    ).toEqual([
      ["CSA Sticker", true, true],
      ["Free Boba", true, false],
      ["Past Merch", false, false],
      ["Pie an Officer/Parent", false, false],
      ["Blindbox", false, false],
    ]);
    const bea = rows.find((row) => row.id === "bea");
    expect(bea?.rewards.every((reward) => reward.eligible)).toBe(true);
    expect(
      bea?.rewards.find((reward) => reward.rewardId === "box")?.pickedUp,
    ).toBe(true);
  });

  it("puts members who still need to pick something up first", () => {
    const rows = compileBattlePassRows(
      [
        {
          id: "done",
          fullName: "Done Member",
          email: "done@tamu.edu",
          jtFamily: null,
          role: "member",
          totalPoints: 20,
        },
        {
          id: "open",
          fullName: "Open Member",
          email: "open@tamu.edu",
          jtFamily: null,
          role: "member",
          totalPoints: 20,
        },
      ],
      [rewards[0]],
      [{ memberId: "done", rewardId: "sticker" }],
    );
    expect(rows.map((row) => row.id)).toEqual(["open", "done"]);
  });

  it("counts eligibility from current points, including people who already picked up", () => {
    const rows = compileBattlePassRows(members, rewards, [
      { memberId: "ada", rewardId: "sticker" },
    ]);
    const summary = summarizeBattlePass(rewards, rows);
    expect(summary.find((reward) => reward.id === "sticker")).toMatchObject({
      eligible: 2,
      pickedUp: 1,
    });
    expect(summary.find((reward) => reward.id === "boba")).toMatchObject({
      eligible: 2,
      pickedUp: 0,
    });
    expect(summary.find((reward) => reward.id === "box")).toMatchObject({
      eligible: 1,
      pickedUp: 0,
    });
  });
});

describe("describeBattlePassProgress", () => {
  it("names the next reward and how many points are left", () => {
    const progress = describeBattlePassProgress(47, rewards, ["sticker"]);
    expect(progress.reachedCount).toBe(2);
    expect(progress.next).toMatchObject({
      name: "Past Merch",
      pointsToGo: 3,
      eligible: false,
    });
    expect(progress.items[0]).toMatchObject({
      name: "CSA Sticker",
      pickedUp: true,
      eligible: true,
      pointsToGo: 0,
    });
  });

  it("has no next reward once every threshold is met", () => {
    const progress = describeBattlePassProgress(90, rewards, []);
    expect(progress.next).toBeNull();
    expect(progress.reachedCount).toBe(5);
  });
});

describe("memberCanPickUpReward", () => {
  const sticker = rewards[0];

  it("lets a dues-paying member pick up at the threshold", () => {
    expect(memberCanPickUpReward({ role: "member" }, 20, sticker)).toBe(true);
    expect(memberCanPickUpReward({ role: "member" }, 19, sticker)).toBe(false);
  });

  it("follows the reward audience, and treats admins as officers", () => {
    const forOfficers = {
      ...sticker,
      redeemMembers: false,
      redeemOfficers: true,
    };
    const forParents = {
      ...sticker,
      redeemMembers: false,
      redeemParents: true,
    };
    const forNobody = {
      ...sticker,
      redeemMembers: false,
      redeemOfficers: false,
      redeemParents: false,
    };

    expect(memberCanPickUpReward({ role: "officer" }, 100, sticker)).toBe(
      false,
    );
    expect(memberCanPickUpReward({ role: "officer" }, 100, forOfficers)).toBe(
      true,
    );
    expect(memberCanPickUpReward({ role: "admin" }, 100, forOfficers)).toBe(
      true,
    );
    expect(
      memberCanPickUpReward(
        { role: "officer", is_parent: true },
        100,
        forParents,
      ),
    ).toBe(true);
    expect(
      memberCanPickUpReward({ role: "member", is_parent: true }, 100, sticker),
    ).toBe(false);
    expect(
      memberCanPickUpReward(
        { role: "member", is_parent: true },
        100,
        forParents,
      ),
    ).toBe(true);
    expect(memberCanPickUpReward({ role: "member" }, 100, forNobody)).toBe(
      false,
    );
  });
});

describe("compileBattlePassRows audience", () => {
  it("includes an officer only for rewards they can redeem", () => {
    const rows = compileBattlePassRows(
      [
        {
          id: "off",
          fullName: "Officer Kim",
          email: "kim@tamu.edu",
          jtFamily: null,
          role: "officer",
          totalPoints: 200,
        },
      ],
      [{ ...rewards[0], redeemOfficers: true }],
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rewards[0]).toMatchObject({
      eligible: true,
      redeemable: true,
    });
  });
});
