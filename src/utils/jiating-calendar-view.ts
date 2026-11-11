import { chicagoWeekMondayKey, EVENT_TIMEZONE } from "@/utils/datetime";
import { isJiatingOlympicsCategory, isMixerCategory } from "@/utils/events";

/**
 * Pure helpers for the officer Jiating calendar view.
 *
 * Times are handled as "Chicago wall-clock ms": the UTC timestamp whose UTC
 * fields equal the America/Chicago local fields. Day and week boundaries are
 * then plain multiples of 24h, independent of the viewer's timezone.
 */

export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

const DEFAULT_DURATION_MS = HOUR_MS;

/** Org-wide categories a Jiating event or mixer should not overlap. */
export const CSA_CONFLICT_CATEGORIES: ReadonlySet<string> = new Set([
  "General Meeting",
  "CSA-Wide",
  "CSA-Wide Mixers",
]);

export const DEFAULT_FAMILY_COLOR = "#4779B8";
export const CSA_LAYER_COLOR = "#64748b";
export const OLYMPICS_LAYER_COLOR = "#d97706";

/**
 * Shared layers that Jiating events and mixers are checked against. Each has
 * its own legend checkbox and URL flag (`csa=0` / `oly=0` hides it).
 */
export type LayerKind = "csa" | "olympics";

export const LAYER_KINDS: readonly LayerKind[] = ["csa", "olympics"];

export const LAYER_META: Record<
  LayerKind,
  { label: string; color: string; param: string }
> = {
  csa: { label: "CSA-wide", color: CSA_LAYER_COLOR, param: "csa" },
  olympics: {
    label: "Jiating Olympics",
    color: OLYMPICS_LAYER_COLOR,
    param: "oly",
  },
};

export type LayerVisibility = Record<LayerKind, boolean>;

export type CalendarSourceEvent = {
  id: string;
  name: string;
  category: string;
  starts_at: string;
  ends_at?: string | null;
  location?: string | null;
  jt_family_id: string | null;
  check_in_type?: string | null;
  publish_status?: string | null;
};

export type CalendarFamily = {
  id: string;
  name: string;
  color: string | null;
};

export type CalendarEntryKind = "jiating" | LayerKind;

export function isLayerKind(kind: CalendarEntryKind): kind is LayerKind {
  return kind !== "jiating";
}

export type CalendarEntry = {
  id: string;
  name: string;
  category: string;
  location: string | null;
  publishStatus: string;
  kind: CalendarEntryKind;
  isMixer: boolean;
  /** Participating Jiatings, in family order. Empty for layer entries. */
  familyIds: string[];
  /** Chicago wall-clock ms. */
  start: number;
  end: number;
  /** Real instants, for display formatting. */
  startsAt: string;
  endsAt: string | null;
};

const wallPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Chicago wall-clock ms for a real instant, or null when unparseable. */
export function toChicagoWallMs(
  instant: string | number | Date,
): number | null {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(
    wallPartsFormatter
      .formatToParts(date)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<string, number>;
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24,
    parts.minute,
    parts.second,
  );
}

/** `YYYY-MM-DD` → wall ms at midnight, or null. */
export function dateKeyToWallMs(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(ms) ? null : ms;
}

export function wallMsToDateKey(wallMs: number): string {
  return new Date(wallMs).toISOString().slice(0, 10);
}

/** Monday key for the week param, falling back to the current Chicago week. */
export function resolveWeekKey(
  raw: string | null | undefined,
  now = new Date(),
): string {
  const parsed = raw ? dateKeyToWallMs(raw) : null;
  if (parsed !== null) {
    // Snap any date to its Monday (UTC weekday of a wall date is the local weekday).
    const offset = (new Date(parsed).getUTCDay() + 6) % 7;
    return wallMsToDateKey(parsed - offset * DAY_MS);
  }
  return chicagoWeekMondayKey(now) ?? wallMsToDateKey(Date.now());
}

export function shiftWeekKey(weekKey: string, weeks: number): string {
  const start = dateKeyToWallMs(weekKey);
  if (start === null) return weekKey;
  return wallMsToDateKey(start + weeks * WEEK_MS);
}

function isJiatingEventCategory(category: string) {
  return category.trim() === "Jiating Event";
}

/** Events that can appear on the calendar, with participating families resolved. */
export function buildCalendarEntries(
  events: readonly CalendarSourceEvent[],
  families: readonly CalendarFamily[],
  mixerFamiliesByEventId: Record<string, readonly string[]>,
): CalendarEntry[] {
  const familyOrder = new Map(families.map((f, i) => [f.id, i]));
  const entries: CalendarEntry[] = [];

  for (const event of events) {
    if (event.check_in_type === "manual_points") continue;
    const category = event.category.trim();

    let kind: CalendarEntryKind;
    let familyIds: string[];
    if (isJiatingEventCategory(category)) {
      if (!event.jt_family_id || !familyOrder.has(event.jt_family_id)) continue;
      kind = "jiating";
      familyIds = [event.jt_family_id];
    } else if (isMixerCategory(category)) {
      kind = "jiating";
      familyIds = [...new Set(mixerFamiliesByEventId[event.id] ?? [])]
        .filter((id) => familyOrder.has(id))
        .sort((a, b) => (familyOrder.get(a) ?? 0) - (familyOrder.get(b) ?? 0));
      if (familyIds.length === 0) continue;
    } else if (CSA_CONFLICT_CATEGORIES.has(category)) {
      kind = "csa";
      familyIds = [];
    } else if (isJiatingOlympicsCategory(category)) {
      kind = "olympics";
      familyIds = [];
    } else {
      continue;
    }

    const start = toChicagoWallMs(event.starts_at);
    if (start === null) continue;
    const parsedEnd = event.ends_at ? toChicagoWallMs(event.ends_at) : null;
    const end =
      parsedEnd !== null && parsedEnd > start
        ? parsedEnd
        : start + DEFAULT_DURATION_MS;

    entries.push({
      id: event.id,
      name: event.name,
      category,
      location: event.location ?? null,
      publishStatus: event.publish_status ?? "published",
      kind,
      isMixer: isMixerCategory(category),
      familyIds,
      start,
      end,
      startsAt: event.starts_at,
      endsAt: event.ends_at ?? null,
    });
  }

  return entries.sort((a, b) => a.start - b.start || a.end - b.end);
}

/** Jiating entries with at least one checked family; layer entries when their layer is on. */
export function filterVisibleEntries(
  entries: readonly CalendarEntry[],
  checkedFamilyIds: ReadonlySet<string>,
  layers: LayerVisibility,
): CalendarEntry[] {
  return entries.filter((entry) =>
    isLayerKind(entry.kind)
      ? layers[entry.kind]
      : entry.familyIds.some((id) => checkedFamilyIds.has(id)),
  );
}

export function entriesOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

export type LayerConflict = { jiatingId: string; layerId: string };

/**
 * A conflict is a Jiating Event or Mixer (with a checked family) overlapping a
 * layer event: a General Meeting, CSA-Wide, or CSA-Wide Mixers event, or a
 * Jiating Olympics event. Layer events count whether or not their layer is
 * shown, so hiding a layer never hides a warning.
 */
export function findLayerConflicts(
  entries: readonly CalendarEntry[],
  checkedFamilyIds: ReadonlySet<string>,
): LayerConflict[] {
  const layerEntries = entries.filter((e) => isLayerKind(e.kind));
  if (layerEntries.length === 0) return [];
  const conflicts: LayerConflict[] = [];
  for (const entry of entries) {
    if (entry.kind !== "jiating") continue;
    if (!entry.familyIds.some((id) => checkedFamilyIds.has(id))) continue;
    for (const other of layerEntries) {
      if (entriesOverlap(entry, other)) {
        conflicts.push({ jiatingId: entry.id, layerId: other.id });
      }
    }
  }
  return conflicts;
}

/** Entries touching [rangeStart, rangeEnd). */
export function entriesInRange<T extends { start: number; end: number }>(
  entries: readonly T[],
  rangeStart: number,
  rangeEnd: number,
): T[] {
  return entries.filter((e) => e.start < rangeEnd && e.end > rangeStart);
}

export type PackedItem<T> = {
  item: T;
  start: number;
  end: number;
  /** Zero-based column (week grid) or row (swimlane) within its overlap cluster. */
  slot: number;
  /** Number of slots in the item's overlap cluster. */
  slotCount: number;
};

/**
 * Greedy interval packing: overlapping items get side-by-side slots, and every
 * item in a cluster shares that cluster's slot count.
 */
export function packOverlaps<T>(
  items: readonly { item: T; start: number; end: number }[],
): PackedItem<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result: PackedItem<T>[] = [];
  let cluster: PackedItem<T>[] = [];
  let slotEnds: number[] = [];
  let clusterEnd = Number.NEGATIVE_INFINITY;

  const flush = () => {
    for (const packed of cluster) packed.slotCount = slotEnds.length;
    result.push(...cluster);
    cluster = [];
    slotEnds = [];
  };

  for (const entry of sorted) {
    if (entry.start >= clusterEnd && cluster.length > 0) flush();
    let slot = slotEnds.findIndex((end) => end <= entry.start);
    if (slot === -1) {
      slot = slotEnds.length;
      slotEnds.push(entry.end);
    } else {
      slotEnds[slot] = entry.end;
    }
    cluster.push({ ...entry, slot, slotCount: 0 });
    clusterEnd =
      cluster.length === 1 ? entry.end : Math.max(clusterEnd, entry.end);
  }
  if (cluster.length > 0) flush();
  return result;
}

/** Day columns for the week grid: each entry clipped to the day and packed. */
export function layoutWeekDays(
  entries: readonly CalendarEntry[],
  weekStart: number,
): PackedItem<CalendarEntry>[][] {
  return Array.from({ length: 7 }, (_, day) => {
    const dayStart = weekStart + day * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    return packOverlaps(
      entriesInRange(entries, dayStart, dayEnd).map((entry) => ({
        item: entry,
        start: Math.max(entry.start, dayStart),
        end: Math.min(entry.end, dayEnd),
      })),
    );
  });
}

/**
 * Hour range to render: defaults to [8, 24) and grows to fit any entry in the
 * week that starts earlier or ends later.
 */
export function visibleHourRange(
  entries: readonly CalendarEntry[],
  weekStart: number,
  defaults: { startHour: number; endHour: number } = {
    startHour: 8,
    endHour: 24,
  },
): { startHour: number; endHour: number } {
  let { startHour, endHour } = defaults;
  for (let day = 0; day < 7; day++) {
    const dayStart = weekStart + day * DAY_MS;
    for (const entry of entriesInRange(entries, dayStart, dayStart + DAY_MS)) {
      const from = Math.max(entry.start, dayStart) - dayStart;
      const to = Math.min(entry.end, dayStart + DAY_MS) - dayStart;
      startHour = Math.min(startHour, Math.floor(from / HOUR_MS));
      endHour = Math.max(endHour, Math.ceil(to / HOUR_MS));
    }
  }
  return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
}

export type HourRange = { startHour: number; endHour: number };

/**
 * Per-day hour windows for the swimlanes. Each day spans from its earliest
 * start to its latest end, measured from that day's midnight, so a 10pm–1am
 * event yields [22, 25) on its start day. `endHour` may pass 24. A day with no
 * events gets `emptyRange`; a day whose events would need more than 24 hours
 * falls back to [0, 24).
 */
export function fitDayHourRanges(
  entries: readonly CalendarEntry[],
  weekStart: number,
  options: { minSpan?: number; emptyRange?: HourRange } = {},
): HourRange[] {
  const minSpan = options.minSpan ?? 4;
  const emptyRange = options.emptyRange ?? { startHour: 18, endHour: 22 };

  return Array.from({ length: 7 }, (_, day) => {
    const dayStart = weekStart + day * DAY_MS;
    let startHour = Number.POSITIVE_INFINITY;
    let endHour = Number.NEGATIVE_INFINITY;
    for (const entry of entries) {
      if (entry.start < dayStart || entry.start >= dayStart + DAY_MS) continue;
      startHour = Math.min(
        startHour,
        Math.floor((entry.start - dayStart) / HOUR_MS),
      );
      endHour = Math.max(endHour, Math.ceil((entry.end - dayStart) / HOUR_MS));
    }
    if (!Number.isFinite(startHour)) return { ...emptyRange };
    if (endHour - startHour > 24) return { startHour: 0, endHour: 24 };

    // Keep a single short event from filling the whole day column.
    while (endHour - startHour < minSpan) {
      if (endHour < 24) endHour += 1;
      if (endHour - startHour < minSpan && startHour > 0) startHour -= 1;
      if (endHour >= 24 && startHour <= 0) break;
    }
    return { startHour, endHour };
  });
}

export type HeatmapCell = {
  /** Checked families with an event in this slot. */
  busyFamilyIds: string[];
  /** A CSA-wide or Olympics event fills this slot (only counted when its layer is on). */
  layerBusy: boolean;
};

/**
 * Busy-ness per day and slot for the free-time overlay. Covers
 * [startHour, endHour) of each day in `slotMinutes` steps.
 */
export function buildBusyHeatmap(input: {
  entries: readonly CalendarEntry[];
  checkedFamilyIds: ReadonlySet<string>;
  layers: LayerVisibility;
  weekStart: number;
  startHour: number;
  endHour: number;
  /** Per-day windows (swimlanes); overrides startHour/endHour when given. */
  dayRanges?: readonly HourRange[];
  slotMinutes?: number;
}): HeatmapCell[][] {
  const slotMs = (input.slotMinutes ?? 30) * MINUTE_MS;

  return Array.from({ length: 7 }, (_, day) => {
    const range = input.dayRanges?.[day] ?? input;
    const slotsPerDay = Math.max(
      0,
      Math.round(((range.endHour - range.startHour) * HOUR_MS) / slotMs),
    );
    const dayStart = input.weekStart + day * DAY_MS + range.startHour * HOUR_MS;
    const dayEntries = entriesInRange(
      input.entries,
      dayStart,
      dayStart + slotsPerDay * slotMs,
    );
    return Array.from({ length: slotsPerDay }, (_, slot) => {
      const slotStart = dayStart + slot * slotMs;
      const slotRange = { start: slotStart, end: slotStart + slotMs };
      const busy = new Set<string>();
      let layerBusy = false;
      for (const entry of dayEntries) {
        if (!entriesOverlap(entry, slotRange)) continue;
        if (isLayerKind(entry.kind)) {
          if (input.layers[entry.kind]) layerBusy = true;
          continue;
        }
        for (const id of entry.familyIds) {
          if (input.checkedFamilyIds.has(id)) busy.add(id);
        }
      }
      return { busyFamilyIds: [...busy], layerBusy };
    });
  });
}

/**
 * `jt` query param → checked family ids (unknown ids dropped).
 * Returns null when the param is absent, or when it lists ids but none are
 * valid (a stale link), so callers fall back to the default selection.
 * An empty value (`jt=`) is a deliberate "none checked" and returns [].
 */
export function parseJtParam(
  raw: string | null | undefined,
  validFamilyIds: readonly string[],
): string[] | null {
  if (raw === null || raw === undefined) return null;
  const requested = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (requested.length === 0) return [];
  const valid = new Set(validFamilyIds);
  const ids = requested.filter((id) => valid.has(id));
  return ids.length > 0 ? ids : null;
}

export function serializeJtParam(familyIds: Iterable<string>): string {
  return [...familyIds].join(",");
}

/** Hex color with an alpha suffix; falls back to the default family color. */
export function withAlpha(
  color: string | null | undefined,
  alphaHex: string,
): string {
  const base =
    color && /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_FAMILY_COLOR;
  return `${base}${alphaHex}`;
}

/** Hard-stop gradient with one band per color (used for mixer stripes). */
export function stripeGradient(
  colors: readonly string[],
  direction = "to bottom",
): string {
  if (colors.length === 0) return DEFAULT_FAMILY_COLOR;
  if (colors.length === 1) return colors[0];
  const step = 100 / colors.length;
  const stops = colors.flatMap((color, i) => [
    `${color} ${(i * step).toFixed(2)}%`,
    `${color} ${((i + 1) * step).toFixed(2)}%`,
  ]);
  return `linear-gradient(${direction}, ${stops.join(", ")})`;
}
