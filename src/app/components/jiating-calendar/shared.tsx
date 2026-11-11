"use client";

import type { CSSProperties } from "react";
import {
  type CalendarEntry,
  type CalendarFamily,
  CSA_LAYER_COLOR,
  DEFAULT_FAMILY_COLOR,
  stripeGradient,
  withAlpha,
} from "@/utils/jiating-calendar-view";

export const wallTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  hour: "numeric",
  minute: "2-digit",
});

export const wallHourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  hour: "numeric",
});

export const wallWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  weekday: "short",
});

export const wallMonthDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});

export function familyColor(family: CalendarFamily | undefined): string {
  return family?.color && /^#[0-9a-f]{6}$/i.test(family.color)
    ? family.color
    : DEFAULT_FAMILY_COLOR;
}

/** Colors for an entry: CSA gray, one family color, or each mixer family in order. */
export function entryColors(
  entry: CalendarEntry,
  familiesById: ReadonlyMap<string, CalendarFamily>,
): string[] {
  if (entry.kind === "csa") return [CSA_LAYER_COLOR];
  return entry.familyIds.map((id) => familyColor(familiesById.get(id)));
}

/** Tinted background and striped accent bar for an event block. */
export function entryStyles(colors: readonly string[]): {
  block: CSSProperties;
  bar: CSSProperties;
} {
  const background =
    colors.length > 1
      ? `linear-gradient(to right, ${colors.map((c) => withAlpha(c, "2e")).join(", ")})`
      : withAlpha(colors[0], "2e");
  return {
    block: { background },
    bar: { background: stripeGradient(colors) },
  };
}

export function formatWallRange(start: number, end: number): string {
  return `${wallTimeFormatter.format(start)} – ${wallTimeFormatter.format(end)}`;
}

/** Thin colored bar + tinted block body shared by the week grid and swimlanes. */
export function EntryBlockContent({
  entry,
  colors,
  start,
  end,
  compact,
  conflict,
}: {
  entry: CalendarEntry;
  colors: string[];
  start: number;
  end: number;
  compact?: boolean;
  conflict?: boolean;
}) {
  const styles = entryStyles(colors);
  return (
    <span
      className={`relative flex h-full w-full overflow-hidden rounded-md text-left ${
        entry.publishStatus !== "published"
          ? "border border-dashed border-subtitle/60"
          : ""
      }`}
      style={styles.block}
    >
      <span className="w-1 shrink-0" style={styles.bar} aria-hidden />
      <span className="min-w-0 flex-1 px-1.5 py-0.5">
        <span className="flex items-center gap-1">
          {conflict && (
            <span
              className="inline-block size-1.5 shrink-0 rounded-full bg-error"
              aria-hidden
            />
          )}
          <span className="truncate text-[11px] font-semibold leading-tight text-text">
            {entry.name}
          </span>
        </span>
        {!compact && (
          <span className="block truncate text-[10px] leading-tight text-subtitle">
            {formatWallRange(start, end)}
          </span>
        )}
      </span>
    </span>
  );
}
