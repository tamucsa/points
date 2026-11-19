import { describe, expect, it } from "vitest";
import {
  eventEarnsPoints,
  noPointsReason,
  parsePointsException,
  pointsCutoffNotice,
} from "@/utils/points-cutoff";

const cutoff = "2026-11-21T18:00:00-06:00";

describe("eventEarnsPoints", () => {
  it("counts everything when there is no cutoff", () => {
    expect(
      eventEarnsPoints({ starts_at: "2026-12-01T18:00:00-06:00" }, null),
    ).toBe(true);
  });

  it("counts events that start before the cutoff", () => {
    expect(
      eventEarnsPoints({ starts_at: "2026-11-21T17:59:00-06:00" }, cutoff),
    ).toBe(true);
  });

  it("does not count an event that starts exactly at the cutoff", () => {
    expect(eventEarnsPoints({ starts_at: cutoff }, cutoff)).toBe(false);
  });

  it("does not count events after the cutoff", () => {
    expect(
      eventEarnsPoints({ starts_at: "2026-11-22T10:00:00-06:00" }, cutoff),
    ).toBe(false);
  });

  it("always beats the cutoff", () => {
    expect(
      eventEarnsPoints(
        { starts_at: "2026-11-22T10:00:00-06:00", points_exception: "always" },
        cutoff,
      ),
    ).toBe(true);
  });

  it("never blocks points even before the cutoff or with no cutoff", () => {
    expect(
      eventEarnsPoints(
        { starts_at: "2026-11-01T10:00:00-06:00", points_exception: "never" },
        cutoff,
      ),
    ).toBe(false);
    expect(
      eventEarnsPoints(
        { starts_at: "2026-11-01T10:00:00-06:00", points_exception: "never" },
        null,
      ),
    ).toBe(false);
  });
});

describe("parsePointsException", () => {
  it("treats unknown values as follow cutoff", () => {
    expect(parsePointsException("sometimes")).toBeNull();
    expect(parsePointsException(undefined)).toBeNull();
    expect(parsePointsException("always")).toBe("always");
  });
});

describe("noPointsReason", () => {
  it("explains why an event has no points", () => {
    expect(noPointsReason({ points_exception: "never" })).toBe("No points");
    expect(noPointsReason({ points_exception: null })).toBe(
      "No points (after cutoff)",
    );
  });
});

describe("pointsCutoffNotice", () => {
  it("is empty without a cutoff", () => {
    expect(pointsCutoffNotice(null)).toBeNull();
  });

  it("says points close before the cutoff and are final after", () => {
    expect(
      pointsCutoffNotice(cutoff, new Date("2026-11-20T12:00:00-06:00")),
    ).toBe("Points close Nov 21, 6:00 PM. Events after that won't add points.");
    expect(
      pointsCutoffNotice(cutoff, new Date("2026-11-22T12:00:00-06:00")),
    ).toBe("Points final as of Nov 21, 6:00 PM.");
  });
});
