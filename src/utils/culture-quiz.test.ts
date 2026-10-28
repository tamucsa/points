import { describe, expect, it } from "vitest";
import {
  checkInRemovalSummary,
  cultureQuizAssignmentError,
  cultureQuizPlaceLabel,
  cultureQuizPoints,
} from "@/utils/culture-quiz";

describe("cultureQuizPoints", () => {
  it("awards 3, 2, and 1", () => {
    expect(cultureQuizPoints(1)).toBe(3);
    expect(cultureQuizPoints(2)).toBe(2);
    expect(cultureQuizPoints(3)).toBe(1);
    expect(cultureQuizPlaceLabel(1)).toBe("1st");
  });
});

describe("cultureQuizAssignmentError", () => {
  it("allows several members to share a place", () => {
    expect(
      cultureQuizAssignmentError([
        { memberId: "a", place: 1 },
        { memberId: "b", place: 1 },
        { memberId: "c", place: 2 },
      ]),
    ).toBeNull();
  });

  it("rejects a member in two places", () => {
    expect(
      cultureQuizAssignmentError([
        { memberId: "a", place: 1 },
        { memberId: "a", place: 2 },
      ]),
    ).toBe("A member can only hold one Culture Quiz place.");
  });

  it("allows a meeting with only first place filled", () => {
    expect(
      cultureQuizAssignmentError([{ memberId: "a", place: 1 }]),
    ).toBeNull();
  });
});

describe("checkInRemovalSummary", () => {
  it("mentions check-in and Culture Quiz points together", () => {
    expect(
      checkInRemovalSummary({
        eventName: "GM 3",
        checkInPoints: 2,
        quizPoints: 3,
      }),
    ).toBe(
      "This removes their attendance for GM 3 and deducts 2 check-in points and 3 Culture Quiz points.",
    );
  });

  it("keeps the cap message when neither source awarded points", () => {
    expect(
      checkInRemovalSummary({
        eventName: "GM 3",
        checkInPoints: 0,
        quizPoints: 0,
      }),
    ).toContain("totals stay the same");
  });
});
