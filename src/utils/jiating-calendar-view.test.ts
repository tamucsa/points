import { describe, expect, it } from "vitest";
import {
  buildBusyHeatmap,
  buildCalendarEntries,
  type CalendarEntry,
  type CalendarSourceEvent,
  DAY_MS,
  dateKeyToWallMs,
  filterVisibleEntries,
  findLayerConflicts,
  fitDayHourRanges,
  HOUR_MS,
  layoutWeekDays,
  packOverlaps,
  parseJtParam,
  resolveWeekKey,
  shiftWeekKey,
  stripeGradient,
  toChicagoWallMs,
  visibleHourRange,
} from "@/utils/jiating-calendar-view";

const families = [
  { id: "a", name: "Jade", color: "#16a34a" },
  { id: "b", name: "Ruby", color: "#dc2626" },
  { id: "c", name: "Pearl", color: null },
];

function event(
  overrides: Partial<CalendarSourceEvent> & { id: string },
): CalendarSourceEvent {
  return {
    name: overrides.id,
    category: "Jiating Event",
    // 2026-11-11 18:00 CST
    starts_at: "2026-11-12T00:00:00Z",
    ends_at: "2026-11-12T02:00:00Z",
    jt_family_id: "a",
    ...overrides,
  };
}

const weekStart = dateKeyToWallMs("2026-11-09") as number;

describe("toChicagoWallMs", () => {
  it("maps an instant to Chicago local fields", () => {
    const wall = toChicagoWallMs("2026-11-12T00:00:00Z") as number;
    expect(new Date(wall).toISOString()).toBe("2026-11-11T18:00:00.000Z");
  });

  it("handles daylight time", () => {
    const wall = toChicagoWallMs("2026-07-01T17:00:00Z") as number;
    expect(new Date(wall).toISOString()).toBe("2026-07-01T12:00:00.000Z");
  });

  it("returns null for bad input", () => {
    expect(toChicagoWallMs("nope")).toBeNull();
  });
});

describe("week keys", () => {
  it("snaps a date to its Monday", () => {
    expect(resolveWeekKey("2026-11-13")).toBe("2026-11-09");
    expect(resolveWeekKey("2026-11-15")).toBe("2026-11-09");
    expect(resolveWeekKey("2026-11-09")).toBe("2026-11-09");
  });

  it("falls back to the current Chicago week", () => {
    expect(resolveWeekKey(null, new Date("2026-11-12T03:00:00Z"))).toBe(
      "2026-11-09",
    );
    expect(resolveWeekKey("garbage", new Date("2026-11-12T03:00:00Z"))).toBe(
      "2026-11-09",
    );
  });

  it("shifts by whole weeks", () => {
    expect(shiftWeekKey("2026-11-09", 1)).toBe("2026-11-16");
    expect(shiftWeekKey("2026-11-02", -1)).toBe("2026-10-26");
  });
});

describe("buildCalendarEntries", () => {
  it("keeps Jiating events, mixers, CSA conflict categories, and Olympics only", () => {
    const entries = buildCalendarEntries(
      [
        event({ id: "jt" }),
        event({ id: "mix", category: "Jiating Mixer", jt_family_id: null }),
        event({ id: "gm", category: "General Meeting", jt_family_id: null }),
        event({ id: "wide", category: "CSA-Wide", jt_family_id: null }),
        event({ id: "wmix", category: "CSA-Wide Mixers", jt_family_id: null }),
        event({ id: "oly", category: "Jiating Olympics", jt_family_id: null }),
        event({ id: "sports", category: "Sports", jt_family_id: null }),
        event({ id: "award", check_in_type: "manual_points" }),
        event({ id: "orphan", jt_family_id: "zzz" }),
        event({
          id: "emptymix",
          category: "Jiating Mixer",
          jt_family_id: null,
        }),
      ],
      families,
      { mix: ["c", "a", "unknown"] },
    );
    expect(entries.map((e) => [e.id, e.kind]).sort()).toEqual([
      ["gm", "csa"],
      ["jt", "jiating"],
      ["mix", "jiating"],
      ["oly", "olympics"],
      ["wide", "csa"],
      ["wmix", "csa"],
    ]);
    const mixer = entries.find((e) => e.id === "mix");
    expect(mixer?.familyIds).toEqual(["a", "c"]);
    expect(mixer?.isMixer).toBe(true);
  });

  it("defaults a missing or invalid end to one hour", () => {
    const [entry] = buildCalendarEntries(
      [event({ id: "x", ends_at: null })],
      families,
      {},
    );
    expect(entry.end - entry.start).toBe(HOUR_MS);
    const [backwards] = buildCalendarEntries(
      [event({ id: "y", ends_at: "2026-11-11T00:00:00Z" })],
      families,
      {},
    );
    expect(backwards.end - backwards.start).toBe(HOUR_MS);
  });
});

function entry(
  id: string,
  kind: CalendarEntry["kind"],
  familyIds: string[],
  startHour: number,
  endHour: number,
  day = 2,
): CalendarEntry {
  const base = weekStart + day * DAY_MS;
  return {
    id,
    name: id,
    category:
      kind === "csa"
        ? "General Meeting"
        : kind === "olympics"
          ? "Jiating Olympics"
          : "Jiating Event",
    location: null,
    publishStatus: "published",
    kind,
    isMixer: familyIds.length > 1,
    familyIds,
    start: base + startHour * HOUR_MS,
    end: base + endHour * HOUR_MS,
    startsAt: "",
    endsAt: null,
  };
}

describe("filterVisibleEntries", () => {
  const entries = [
    entry("a1", "jiating", ["a"], 18, 20),
    entry("mix", "jiating", ["b", "c"], 18, 20),
    entry("gm", "csa", [], 19, 21),
    entry("oly", "olympics", [], 12, 16),
  ];

  it("shows a mixer when any participating family is checked", () => {
    const ids = filterVisibleEntries(entries, new Set(["c"]), {
      csa: false,
      olympics: false,
    }).map((e) => e.id);
    expect(ids).toEqual(["mix"]);
  });

  it("toggles each layer on its own", () => {
    expect(
      filterVisibleEntries(entries, new Set(), {
        csa: true,
        olympics: false,
      }).map((e) => e.id),
    ).toEqual(["gm"]);
    expect(
      filterVisibleEntries(entries, new Set(), {
        csa: false,
        olympics: true,
      }).map((e) => e.id),
    ).toEqual(["oly"]);
  });
});

describe("findLayerConflicts", () => {
  const entries = [
    entry("a1", "jiating", ["a"], 18, 20),
    entry("b1", "jiating", ["b"], 18, 20),
    entry("mix", "jiating", ["a", "b"], 21, 22),
    entry("gm", "csa", [], 19, 21),
    entry("wide", "csa", [], 21, 23, 4),
  ];

  it("flags Jiating vs CSA overlaps only", () => {
    expect(findLayerConflicts(entries, new Set(["a", "b"]))).toEqual([
      { jiatingId: "a1", layerId: "gm" },
      { jiatingId: "b1", layerId: "gm" },
    ]);
  });

  it("ignores Jiating-only overlaps and touching edges", () => {
    // a1 and b1 overlap each other; mix starts exactly when gm ends.
    const conflicts = findLayerConflicts(entries, new Set(["a", "b"]));
    expect(conflicts.some((c) => c.jiatingId === "mix")).toBe(false);
  });

  it("flags Jiating vs Jiating Olympics overlaps too", () => {
    const withOlympics = [
      ...entries,
      entry("oly", "olympics", [], 12, 18.5),
      entry("a-noon", "jiating", ["a"], 11, 13),
    ];
    const conflicts = findLayerConflicts(withOlympics, new Set(["a", "b"]));
    expect(conflicts).toContainEqual({ jiatingId: "a-noon", layerId: "oly" });
    expect(conflicts).toContainEqual({ jiatingId: "a1", layerId: "oly" });
    expect(conflicts).toContainEqual({ jiatingId: "b1", layerId: "oly" });
    // Olympics vs CSA-wide is not a Jiating conflict.
    expect(conflicts.some((c) => c.jiatingId === "gm")).toBe(false);
  });

  it("skips families that are unchecked", () => {
    expect(findLayerConflicts(entries, new Set(["b"]))).toEqual([
      { jiatingId: "b1", layerId: "gm" },
    ]);
  });
});

describe("packOverlaps", () => {
  it("puts overlapping items side by side and reuses free slots", () => {
    const packed = packOverlaps([
      { item: "x", start: 0, end: 10 },
      { item: "y", start: 5, end: 15 },
      { item: "z", start: 10, end: 20 },
      { item: "solo", start: 30, end: 40 },
    ]);
    const byItem = Object.fromEntries(
      packed.map((p) => [p.item, [p.slot, p.slotCount]]),
    );
    expect(byItem).toEqual({ x: [0, 2], y: [1, 2], z: [0, 2], solo: [0, 1] });
  });
});

describe("layoutWeekDays", () => {
  it("splits an overnight event across both days", () => {
    const overnight = entry("late", "jiating", ["a"], 22, 26);
    const days = layoutWeekDays([overnight], weekStart);
    expect(days[2]).toHaveLength(1);
    expect(days[3]).toHaveLength(1);
    expect(days[3][0].start).toBe(weekStart + 3 * DAY_MS);
  });
});

describe("visibleHourRange", () => {
  it("defaults to 8–24 and grows for early events", () => {
    expect(visibleHourRange([], weekStart)).toEqual({
      startHour: 8,
      endHour: 24,
    });
    expect(
      visibleHourRange([entry("early", "jiating", ["a"], 6.5, 9)], weekStart),
    ).toEqual({ startHour: 6, endHour: 24 });
  });
});

describe("buildBusyHeatmap", () => {
  const entries = [
    entry("a1", "jiating", ["a"], 18, 19),
    entry("mix", "jiating", ["a", "b"], 18.5, 19.5),
    entry("gm", "csa", [], 20, 21),
  ];

  it("counts checked families per slot", () => {
    const grid = buildBusyHeatmap({
      entries,
      checkedFamilyIds: new Set(["a", "b"]),
      layers: { csa: true, olympics: true },
      weekStart,
      startHour: 18,
      endHour: 21,
    });
    expect(grid).toHaveLength(7);
    const day = grid[2].map((c) => [
      c.busyFamilyIds.sort().join(""),
      c.layerBusy,
    ]);
    expect(day).toEqual([
      ["a", false],
      ["ab", false],
      ["ab", false],
      ["", false],
      ["", true],
      ["", true],
    ]);
  });

  it("marks Olympics slots busy only when that layer is on", () => {
    const olympics = [entry("oly", "olympics", [], 18, 19)];
    const on = buildBusyHeatmap({
      entries: olympics,
      checkedFamilyIds: new Set(),
      layers: { csa: false, olympics: true },
      weekStart,
      startHour: 18,
      endHour: 19,
    });
    expect(on[2].every((c) => c.layerBusy)).toBe(true);
    const off = buildBusyHeatmap({
      entries: olympics,
      checkedFamilyIds: new Set(),
      layers: { csa: true, olympics: false },
      weekStart,
      startHour: 18,
      endHour: 19,
    });
    expect(off[2].some((c) => c.layerBusy)).toBe(false);
  });

  it("ignores CSA when the layer is off and unchecked families", () => {
    const grid = buildBusyHeatmap({
      entries,
      checkedFamilyIds: new Set(["b"]),
      layers: { csa: false, olympics: false },
      weekStart,
      startHour: 20,
      endHour: 21,
    });
    expect(
      grid[2].every((c) => !c.layerBusy && c.busyFamilyIds.length === 0),
    ).toBe(true);
  });
});

describe("parseJtParam", () => {
  it("returns null when absent and drops unknown ids", () => {
    expect(parseJtParam(null, ["a", "b"])).toBeNull();
    expect(parseJtParam("a,zzz,a", ["a", "b"])).toEqual(["a"]);
    expect(parseJtParam("", ["a"])).toEqual([]);
  });

  it("treats a link with only unknown ids as absent", () => {
    expect(parseJtParam("zzz,yyy", ["a", "b"])).toBeNull();
    expect(parseJtParam(" , ", ["a"])).toEqual([]);
  });
});

describe("stripeGradient", () => {
  it("uses a plain color for one family and hard stops for several", () => {
    expect(stripeGradient(["#111111"])).toBe("#111111");
    expect(stripeGradient(["#111111", "#222222"])).toBe(
      "linear-gradient(to bottom, #111111 0.00%, #111111 50.00%, #222222 50.00%, #222222 100.00%)",
    );
  });
});

describe("fitDayHourRanges", () => {
  it("fits each day to its own events", () => {
    const ranges = fitDayHourRanges(
      [
        entry("a", "jiating", ["a"], 18.5, 20, 1),
        entry("b", "jiating", ["b"], 19, 21.25, 1),
        entry("trip", "jiating", ["c"], 8.5, 9.5, 5),
        entry("eve", "jiating", ["c"], 20, 22, 5),
      ],
      weekStart,
    );
    expect(ranges[1]).toEqual({ startHour: 18, endHour: 22 });
    expect(ranges[5]).toEqual({ startHour: 8, endHour: 22 });
    // Empty days use the default evening window.
    expect(ranges[0]).toEqual({ startHour: 18, endHour: 22 });
  });

  it("keeps an overnight event on its start day", () => {
    const ranges = fitDayHourRanges(
      [entry("late", "jiating", ["a"], 21, 25)],
      weekStart,
    );
    expect(ranges[2]).toEqual({ startHour: 21, endHour: 25 });
  });

  it("widens a lone short event to the minimum span", () => {
    const ranges = fitDayHourRanges(
      [entry("x", "jiating", ["a"], 19, 20)],
      weekStart,
    );
    expect(ranges[2]).toEqual({ startHour: 18, endHour: 22 });
  });

  it("falls back to the full day when a day would need more than 24 hours", () => {
    const ranges = fitDayHourRanges(
      [
        entry("early", "jiating", ["a"], 1, 2),
        entry("late", "jiating", ["a"], 22, 26),
      ],
      weekStart,
    );
    expect(ranges[2]).toEqual({ startHour: 0, endHour: 24 });
  });
});

describe("buildBusyHeatmap with per-day ranges", () => {
  it("uses each day's own window", () => {
    const grid = buildBusyHeatmap({
      entries: [entry("a1", "jiating", ["a"], 18, 19)],
      checkedFamilyIds: new Set(["a"]),
      layers: { csa: false, olympics: false },
      weekStart,
      startHour: 0,
      endHour: 24,
      dayRanges: Array.from({ length: 7 }, (_, d) =>
        d === 2
          ? { startHour: 18, endHour: 20 }
          : { startHour: 18, endHour: 22 },
      ),
    });
    expect(grid[2]).toHaveLength(4);
    expect(grid[0]).toHaveLength(8);
    expect(grid[2][0].busyFamilyIds).toEqual(["a"]);
  });
});
