"use client";

import {
  type CalendarEntry,
  type CalendarFamily,
  DAY_MS,
  HOUR_MS,
  type HourRange,
  isLayerKind,
  LAYER_KINDS,
  LAYER_META,
  type LayerVisibility,
  packOverlaps,
} from "@/utils/jiating-calendar-view";
import {
  EntryBlockContent,
  entryColors,
  familyColor,
  formatWallRange,
  wallHourFormatter,
  wallMonthDayFormatter,
  wallWeekdayFormatter,
} from "./shared";
import { type HeatmapOverlay, heatCellStyle } from "./WeekGrid";

const ROW_PX = 26;
const LANE_PAD_PX = 6;

interface Props {
  entries: CalendarEntry[];
  families: CalendarFamily[];
  checked: ReadonlySet<string>;
  layers: LayerVisibility;
  weekStart: number;
  /** Hour window per day, fitted to that day's events. */
  dayRanges: HourRange[];
  familiesById: ReadonlyMap<string, CalendarFamily>;
  conflictIds: ReadonlySet<string>;
  heatmap: HeatmapOverlay | null;
  nowWall: number | null;
  onSelect: (entry: CalendarEntry, anchor: DOMRect) => void;
}

type Lane = {
  id: string;
  label: string;
  color: string;
  entries: CalendarEntry[];
};

export default function SwimlaneView({
  entries,
  families,
  checked,
  layers,
  weekStart,
  dayRanges,
  familiesById,
  conflictIds,
  heatmap,
  nowWall,
  onSelect,
}: Props) {
  const windowOf = (day: number) => {
    const range = dayRanges[day] ?? { startHour: 0, endHour: 24 };
    const start = weekStart + day * DAY_MS + range.startHour * HOUR_MS;
    const spanMs = (range.endHour - range.startHour) * HOUR_MS;
    return { start, end: start + spanMs, spanMs, ...range };
  };
  // `entries` is already filtered, so layer entries here belong to shown layers.
  const layerEntries = entries.filter((e) => isLayerKind(e.kind));

  const lanes: Lane[] = [
    ...LAYER_KINDS.filter((layer) => layers[layer]).map((layer) => ({
      id: layer,
      label: LAYER_META[layer].label,
      color: LAYER_META[layer].color,
      entries: entries.filter((e) => e.kind === layer),
    })),
    ...families
      .filter((f) => checked.has(f.id))
      .map((family) => ({
        id: family.id,
        label: family.name,
        color: familyColor(family),
        entries: entries.filter(
          (e) => e.kind === "jiating" && e.familyIds.includes(family.id),
        ),
      })),
  ];

  /** Left offset (%) of a wall time in the week strip, clipped to the visible hours. */
  const xPct = (wall: number, day: number) => {
    const window = windowOf(day);
    const within = Math.min(Math.max(wall - window.start, 0), window.spanMs);
    return ((day + within / window.spanMs) / 7) * 100;
  };

  /** Each entry split into per-day visible segments. */
  const segmentsFor = (laneEntries: CalendarEntry[]) =>
    laneEntries.flatMap((entry) => {
      const parts: {
        item: CalendarEntry;
        start: number;
        end: number;
        day: number;
      }[] = [];
      for (let day = 0; day < 7; day++) {
        const window = windowOf(day);
        const start = Math.max(entry.start, window.start);
        const end = Math.min(entry.end, window.end);
        if (start < end) parts.push({ item: entry, start, end, day });
      }
      return parts;
    });

  const ticksFor = (day: number) => {
    const { startHour, endHour } = windowOf(day);
    const span = endHour - startHour;
    // About four labels per day keeps narrow day columns readable.
    const step = Math.max(1, Math.ceil(span / 4));
    const ticks: number[] = [];
    for (let h = startHour; h < endHour; h += step) ticks.push(h);
    return ticks;
  };

  const nowDay =
    nowWall !== null && nowWall >= weekStart && nowWall < weekStart + 7 * DAY_MS
      ? Math.floor((nowWall - weekStart) / DAY_MS)
      : -1;
  // A day's window can run past midnight (endHour > 24), so the current time
  // may belong to the previous day's strip.
  const nowWindowDay =
    nowWall === null
      ? -1
      : (Array.from({ length: 7 }, (_, day) => day).find((day) => {
          const window = windowOf(day);
          return nowWall >= window.start && nowWall < window.end;
        }) ?? -1);
  const nowInWindow = nowWindowDay >= 0;

  const dayLines = Array.from({ length: 7 }, (_, day) => (
    <div
      key={weekStart + day * DAY_MS}
      className="pointer-events-none absolute inset-y-0 border-l border-home-border"
      style={{ left: `${(day / 7) * 100}%` }}
    />
  ));

  return (
    <div className="overflow-hidden rounded-3xl border border-home-border bg-surface shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header */}
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] border-b border-home-border">
            <div className="sticky left-0 z-20 bg-surface" />
            <div className="relative h-12">
              {dayLines}
              {Array.from({ length: 7 }, (_, day) => {
                const dayStart = weekStart + day * DAY_MS;
                return (
                  <div
                    key={dayStart}
                    className="absolute top-1 px-2"
                    style={{
                      left: `${(day / 7) * 100}%`,
                      width: `${100 / 7}%`,
                    }}
                  >
                    <span
                      className={`text-xs font-bold ${day === nowDay ? "text-primary" : "text-text"}`}
                    >
                      {wallWeekdayFormatter.format(dayStart)}{" "}
                      {wallMonthDayFormatter.format(dayStart).split(" ")[1]}
                    </span>
                    <div className="relative -mx-2 mt-1 h-3">
                      {ticksFor(day).map((h) => (
                        <span
                          key={h}
                          className="absolute text-[9px] text-subtitle"
                          style={{
                            left: `${((h - windowOf(day).startHour) / (windowOf(day).endHour - windowOf(day).startHour)) * 100}%`,
                          }}
                        >
                          {wallHourFormatter
                            .format(h * HOUR_MS)
                            .replace(" ", "")
                            .toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {lanes.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-subtitle">
              Check a Jiating or a shared layer to see lanes.
            </p>
          )}

          {/* Lanes */}
          <div className="relative">
            {lanes.map((lane) => {
              const packed = packOverlaps(segmentsFor(lane.entries));
              const rows = Math.max(1, ...packed.map((p) => p.slot + 1));
              return (
                <div
                  key={lane.id}
                  className="grid grid-cols-[7rem_minmax(0,1fr)] border-b border-home-border last:border-b-0"
                >
                  <div className="sticky left-0 z-20 flex items-center gap-2 bg-surface px-3">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: lane.color }}
                      aria-hidden
                    />
                    <span className="truncate text-xs font-semibold text-text">
                      {lane.label}
                    </span>
                  </div>
                  <div
                    className="relative"
                    style={{ height: rows * ROW_PX + LANE_PAD_PX * 2 }}
                  >
                    {dayLines}
                    {/* Layer bands make shared-event overlaps visible in every family lane. */}
                    {!(LAYER_KINDS as readonly string[]).includes(lane.id) &&
                      packOverlaps(segmentsFor(layerEntries)).map(
                        ({ item, start, end }) => {
                          const day = Math.floor((start - weekStart) / DAY_MS);
                          const left = xPct(start, day);
                          return (
                            <div
                              key={`band-${item.id}-${start}`}
                              className="pointer-events-none absolute inset-y-0"
                              style={{
                                left: `${left}%`,
                                width: `${xPct(end, day) - left}%`,
                                background: `${isLayerKind(item.kind) ? LAYER_META[item.kind].color : LAYER_META.csa.color}1f`,
                              }}
                            />
                          );
                        },
                      )}
                    {packed.map(({ item, start, end, slot }) => {
                      const day = Math.floor((start - weekStart) / DAY_MS);
                      const left = xPct(start, day);
                      const width = Math.max(xPct(end, day) - left, 0.6);
                      const conflict = conflictIds.has(item.id);
                      const colors =
                        item.kind === "jiating" && item.isMixer
                          ? entryColors(item, familiesById)
                          : [lane.color];
                      return (
                        <button
                          key={`${item.id}-${start}`}
                          type="button"
                          onClick={(e) =>
                            onSelect(
                              item,
                              e.currentTarget.getBoundingClientRect(),
                            )
                          }
                          className={`absolute z-10 rounded-md p-px transition hover:z-20 hover:shadow-theme-sm focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-primary ${
                            conflict
                              ? "ring-2 ring-error ring-offset-1 ring-offset-surface"
                              : ""
                          }`}
                          style={{
                            top: LANE_PAD_PX + slot * ROW_PX,
                            height: ROW_PX - 4,
                            left: `${left}%`,
                            width: `${width}%`,
                          }}
                          title={`${item.name} · ${formatWallRange(item.start, item.end)}`}
                        >
                          <EntryBlockContent
                            entry={item}
                            colors={colors}
                            start={item.start}
                            end={item.end}
                            compact
                            conflict={conflict}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {heatmap && lanes.length > 0 && (
              <div className="grid grid-cols-[7rem_minmax(0,1fr)] border-t border-home-border">
                <div className="sticky left-0 z-20 flex items-center bg-surface px-3 text-xs font-semibold text-subtitle">
                  Busy
                </div>
                <div className="relative h-7">
                  {heatmap.cells.map((daySlots, day) =>
                    daySlots.map((cell, slot) => {
                      const slotWidth = 100 / 7 / daySlots.length;
                      return (
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: fixed slot grid
                          key={`${day}-${slot}`}
                          className="absolute inset-y-1"
                          style={{
                            left: `${(day / 7) * 100 + slot * slotWidth}%`,
                            width: `${slotWidth}%`,
                            ...heatCellStyle(cell, heatmap.denominator),
                          }}
                        />
                      );
                    }),
                  )}
                  {dayLines}
                </div>
              </div>
            )}

            {nowInWindow && nowWall !== null && (
              <div className="pointer-events-none absolute inset-y-0 left-[7rem] right-0">
                <div
                  className="absolute inset-y-0 z-30 border-l-2 border-error"
                  style={{ left: `${xPct(nowWall, nowWindowDay)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
