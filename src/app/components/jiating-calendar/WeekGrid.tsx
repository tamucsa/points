"use client";

import {
  type CalendarEntry,
  type CalendarFamily,
  DAY_MS,
  type HeatmapCell,
  HOUR_MS,
  layoutWeekDays,
} from "@/utils/jiating-calendar-view";
import {
  EntryBlockContent,
  entryColors,
  formatWallRange,
  wallHourFormatter,
  wallMonthDayFormatter,
  wallWeekdayFormatter,
} from "./shared";

const HOUR_PX = 48;
const MIN_BLOCK_PX = 20;

export type HeatmapOverlay = {
  cells: HeatmapCell[][];
  slotMinutes: number;
  /** Checked families plus each shown layer; 0 means nothing to measure. */
  denominator: number;
};

interface Props {
  entries: CalendarEntry[];
  weekStart: number;
  startHour: number;
  endHour: number;
  familiesById: ReadonlyMap<string, CalendarFamily>;
  conflictIds: ReadonlySet<string>;
  heatmap: HeatmapOverlay | null;
  nowWall: number | null;
  onSelect: (entry: CalendarEntry, anchor: DOMRect) => void;
}

export function heatCellStyle(cell: HeatmapCell, denominator: number) {
  const busy = cell.busyFamilyIds.length + (cell.layerBusy ? 1 : 0);
  if (busy === 0) {
    return { background: "color-mix(in srgb, #10b981 16%, transparent)" };
  }
  // A CSA-wide or Olympics event blocks everyone, so it shades the slot fully.
  const ratio = cell.layerBusy ? 1 : busy / Math.max(1, denominator);
  const pct = Math.round(14 + ratio * 36);
  return {
    background: `color-mix(in srgb, var(--theme-primary) ${pct}%, transparent)`,
  };
}

export default function WeekGrid({
  entries,
  weekStart,
  startHour,
  endHour,
  familiesById,
  conflictIds,
  heatmap,
  nowWall,
  onSelect,
}: Props) {
  const days = layoutWeekDays(entries, weekStart);
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i,
  );
  const bodyHeight = hours.length * HOUR_PX;
  const pxPerMs = HOUR_PX / HOUR_MS;
  const todayIndex =
    nowWall !== null && nowWall >= weekStart && nowWall < weekStart + 7 * DAY_MS
      ? Math.floor((nowWall - weekStart) / DAY_MS)
      : -1;

  return (
    <div className="overflow-hidden rounded-3xl border border-home-border bg-surface shadow-sm">
      <div className="max-h-[72vh] overflow-auto">
        <div className="min-w-[720px]">
          {/* Day headers */}
          <div className="sticky top-0 z-20 grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-home-border bg-surface">
            <div />
            {days.map((_, day) => {
              const dayStart = weekStart + day * DAY_MS;
              const isToday = day === todayIndex;
              return (
                <div
                  key={dayStart}
                  className="border-l border-home-border px-2 py-2 text-center"
                >
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-subtitle">
                    {wallWeekdayFormatter.format(dayStart)}
                  </div>
                  <div
                    className={`mx-auto mt-0.5 inline-flex min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-bold ${
                      isToday ? "bg-primary text-on-primary" : "text-text"
                    }`}
                  >
                    {wallMonthDayFormatter.format(dayStart).split(" ")[1]}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Body */}
          <div
            className="relative grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]"
            style={{ height: bodyHeight }}
          >
            {/* Hour gutter */}
            <div className="relative">
              {hours.map((hour, i) => (
                <div
                  key={hour}
                  className="absolute right-1.5 -translate-y-1/2 text-[10px] text-subtitle"
                  style={{ top: i * HOUR_PX }}
                >
                  {i === 0 ? "" : wallHourFormatter.format(hour * HOUR_MS)}
                </div>
              ))}
            </div>

            {days.map((packed, day) => {
              const dayStart = weekStart + day * DAY_MS;
              const gridStart = dayStart + startHour * HOUR_MS;
              const heatCells = heatmap?.cells[day] ?? null;
              const slotPx = heatmap ? (heatmap.slotMinutes / 60) * HOUR_PX : 0;
              return (
                <div
                  key={dayStart}
                  className={`relative border-l border-home-border ${day === todayIndex ? "bg-primary/[0.03]" : ""}`}
                >
                  {hours.map((hour, i) => (
                    <div
                      key={hour}
                      className="absolute inset-x-0 border-t border-home-border/70"
                      style={{ top: i * HOUR_PX }}
                    />
                  ))}

                  {heatCells?.map((cell, slot) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed slot grid
                      key={slot}
                      className="absolute inset-x-0"
                      style={{
                        top: slot * slotPx,
                        height: slotPx,
                        ...heatCellStyle(cell, heatmap?.denominator ?? 0),
                      }}
                      title={
                        cell.busyFamilyIds.length === 0 && !cell.layerBusy
                          ? "Open for every checked Jiating"
                          : undefined
                      }
                    />
                  ))}

                  {packed.map(({ item, start, end, slot, slotCount }) => {
                    const top = Math.max(0, (start - gridStart) * pxPerMs);
                    const height = Math.max(
                      MIN_BLOCK_PX,
                      (end - start) * pxPerMs - 2,
                    );
                    const widthPct = 100 / slotCount;
                    const conflict = conflictIds.has(item.id);
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
                        } ${heatmap ? "opacity-75" : ""}`}
                        style={{
                          top,
                          height,
                          left: `calc(${slot * widthPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                        title={`${item.name} · ${formatWallRange(item.start, item.end)}`}
                      >
                        <EntryBlockContent
                          entry={item}
                          colors={entryColors(item, familiesById)}
                          start={item.start}
                          end={item.end}
                          compact={height < 34}
                          conflict={conflict}
                        />
                      </button>
                    );
                  })}

                  {day === todayIndex &&
                    nowWall !== null &&
                    nowWall >= gridStart &&
                    nowWall < dayStart + endHour * HOUR_MS && (
                      <div
                        className="pointer-events-none absolute inset-x-0 z-30 border-t-2 border-error"
                        style={{ top: (nowWall - gridStart) * pxPerMs }}
                      >
                        <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-error" />
                      </div>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
