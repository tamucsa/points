import { describe, expect, it } from "vitest";
import {
  attendanceAwardsPoints,
  canAccessOfficerEvents,
  canAccessOfficerMembers,
  earnsPoints,
  earnsRewards,
  isMemberRole,
  isParentOnly,
  memberRoleLabel,
} from "@/utils/members";
import {
  canDeleteEvent,
  parentCanManageEvent,
  parentCreateEventError,
} from "@/utils/events";

describe("parent access helpers", () => {
  it("treats parent as a flag that stacks with officer", () => {
    expect(isMemberRole("parent")).toBe(false);
    expect(memberRoleLabel("parent")).toBe("Parent");
    expect(memberRoleLabel("member", true)).toBe("Parent");
    expect(memberRoleLabel("officer", true)).toBe("Officer · Parent");
    expect(isParentOnly({ role: "member", is_parent: true })).toBe(true);
    expect(isParentOnly({ role: "officer", is_parent: true })).toBe(false);
  });

  it("does not award points to anyone marked parent", () => {
    expect(earnsPoints({ role: "member", is_parent: true })).toBe(false);
    expect(earnsPoints({ role: "officer", is_parent: true })).toBe(false);
    expect(attendanceAwardsPoints({ role: "officer", is_parent: true }, true)).toBe(
      false,
    );
    expect(earnsPoints({ role: "member" })).toBe(true);
    expect(earnsPoints({ role: "officer" })).toBe(true);
    expect(attendanceAwardsPoints({ role: "member" }, true)).toBe(true);
    expect(attendanceAwardsPoints({ role: "member" }, false)).toBe(false);
  });

  it("limits rewards to non-parent members", () => {
    expect(earnsRewards({ role: "member" })).toBe(true);
    expect(earnsRewards({ role: "member", is_parent: true })).toBe(false);
    expect(earnsRewards({ role: "officer" })).toBe(false);
    expect(earnsRewards({ role: "admin" })).toBe(false);
  });

  it("lets parents into officer events and the member roster", () => {
    const parentOnly = { role: "member", is_parent: true };
    expect(canAccessOfficerEvents(parentOnly)).toBe(true);
    expect(canAccessOfficerMembers(parentOnly)).toBe(true);

    const officerParent = { role: "officer", is_parent: true };
    expect(canAccessOfficerEvents(officerParent)).toBe(true);
    expect(canAccessOfficerMembers(officerParent)).toBe(true);
  });

  it("restricts parent-only event creation to their Jiating Event and Mixer", () => {
    const jt = "jt-1";
    expect(
      parentCreateEventError({
        category: "General Meeting",
        jtFamilyId: null,
        jtFamilyIds: [],
        memberJtFamilyId: jt,
      }),
    ).toMatch(/Jiating Event and Jiating Mixer/);
    expect(
      parentCreateEventError({
        category: "Jiating Event",
        jtFamilyId: "other",
        jtFamilyIds: [],
        memberJtFamilyId: jt,
      }),
    ).toMatch(/own Jiating/);
    expect(
      parentCreateEventError({
        category: "Jiating Event",
        jtFamilyId: jt,
        jtFamilyIds: [],
        memberJtFamilyId: jt,
      }),
    ).toBeNull();
    expect(
      parentCreateEventError({
        category: "Jiating Mixer",
        jtFamilyId: null,
        jtFamilyIds: ["other"],
        memberJtFamilyId: jt,
      }),
    ).toMatch(/include their own/);
    expect(
      parentCreateEventError({
        category: "Jiating Mixer",
        jtFamilyId: null,
        jtFamilyIds: [jt, "other"],
        memberJtFamilyId: jt,
      }),
    ).toBeNull();
    expect(
      parentCanManageEvent({
        category: "Jiating Event",
        jtFamilyId: jt,
        memberJtFamilyId: jt,
      }),
    ).toBe(true);
    expect(
      parentCanManageEvent({
        category: "CSA-Wide",
        jtFamilyId: null,
        memberJtFamilyId: jt,
      }),
    ).toBe(false);
  });

  it("splits event delete between officers and parents", () => {
    const jt = "jt-1";
    const parentOnly = { role: "member", is_parent: true, jt_family_id: jt };
    const officer = { role: "officer", is_parent: false, jt_family_id: jt };
    const officerParent = { role: "officer", is_parent: true, jt_family_id: jt };
    const admin = { role: "admin", is_parent: false, jt_family_id: null };

    expect(
      canDeleteEvent({
        member: parentOnly,
        category: "Jiating Event",
        jtFamilyId: jt,
      }),
    ).toBe(true);
    expect(
      canDeleteEvent({
        member: parentOnly,
        category: "Jiating Event",
        jtFamilyId: "other",
      }),
    ).toBe(false);
    expect(
      canDeleteEvent({
        member: parentOnly,
        category: "General Meeting",
        jtFamilyId: null,
      }),
    ).toBe(false);

    expect(
      canDeleteEvent({
        member: officer,
        category: "General Meeting",
        jtFamilyId: null,
      }),
    ).toBe(true);
    expect(
      canDeleteEvent({
        member: officer,
        category: "Jiating Mixer",
        jtFamilyId: null,
        mixerFamilyIds: [jt, "other"],
      }),
    ).toBe(false);

    expect(
      canDeleteEvent({
        member: officerParent,
        category: "CSA-Wide",
        jtFamilyId: null,
      }),
    ).toBe(true);
    expect(
      canDeleteEvent({
        member: officerParent,
        category: "Jiating Mixer",
        jtFamilyId: null,
        mixerFamilyIds: [jt, "other"],
      }),
    ).toBe(true);
    expect(
      canDeleteEvent({
        member: officerParent,
        category: "Jiating Mixer",
        jtFamilyId: null,
        mixerFamilyIds: ["other"],
      }),
    ).toBe(false);

    expect(
      canDeleteEvent({
        member: admin,
        category: "Jiating Event",
        jtFamilyId: "other",
      }),
    ).toBe(true);
  });
});
