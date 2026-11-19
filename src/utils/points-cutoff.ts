import { EVENT_TIMEZONE } from "@/utils/datetime";

/**
 * Per-event admin override of the semester points cutoff.
 * `null` = follow the cutoff, `always` = earns points even after it,
 * `never` = earns no points even before it.
 */
export type PointsException = "always" | "never" | null;

export const POINTS_EXCEPTION_OPTIONS: {
  value: PointsException;
  label: string;
  description: string;
}[] = [
  {
    value: null,
    label: "Follow cutoff",
    description: "Earns points only if it starts before the semester cutoff.",
  },
  {
    value: "always",
    label: "Always count",
    description: "Earns points even if it starts after the cutoff.",
  },
  {
    value: "never",
    label: "Never count",
    description: "Earns no points, even before the cutoff.",
  },
];

export function parsePointsException(value: unknown): PointsException {
  return value === "always" || value === "never" ? value : null;
}

export function pointsExceptionLabel(value: unknown): string {
  const parsed = parsePointsException(value);
  return (
    POINTS_EXCEPTION_OPTIONS.find((o) => o.value === parsed)?.label ??
    "Follow cutoff"
  );
}

/**
 * Same rule as SQL `public.event_earns_points`. An event that starts exactly at
 * the cutoff does NOT earn points.
 */
export function eventEarnsPoints(
  event: { starts_at: string; points_exception?: string | null },
  pointsCutoffAt: string | null | undefined,
): boolean {
  const exception = parsePointsException(event.points_exception);
  if (exception === "always") return true;
  if (exception === "never") return false;
  if (!pointsCutoffAt) return true;
  const start = new Date(event.starts_at).getTime();
  const cutoff = new Date(pointsCutoffAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(cutoff)) return true;
  return start < cutoff;
}

/** Label shown on events that are past the cutoff (or marked never). */
export function noPointsReason(event: {
  points_exception?: string | null;
}): string {
  return parsePointsException(event.points_exception) === "never"
    ? "No points"
    : "No points (after cutoff)";
}

const cutoffFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIMEZONE,
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** e.g. "Nov 21, 6:00 PM" in Central time. */
export function formatPointsCutoff(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : cutoffFormatter.format(date);
}

/** Leaderboard notice text, or null when there is no cutoff. */
export function pointsCutoffNotice(
  pointsCutoffAt: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!pointsCutoffAt) return null;
  const cutoff = new Date(pointsCutoffAt);
  if (Number.isNaN(cutoff.getTime())) return null;
  const label = formatPointsCutoff(pointsCutoffAt);
  return cutoff.getTime() <= now.getTime()
    ? `Points final as of ${label}.`
    : `Points close ${label}. Events after that won't add points.`;
}
