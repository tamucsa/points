"use client";

import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Rows3,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EventJiatingPills from "@/app/components/EventJiatingPills";
import { formatEventSchedule } from "@/utils/datetime";
import {
  buildBusyHeatmap,
  buildCalendarEntries,
  type CalendarEntry,
  type CalendarFamily,
  type CalendarSourceEvent,
  dateKeyToWallMs,
  entriesInRange,
  filterVisibleEntries,
  findLayerConflicts,
  fitDayHourRanges,
  isLayerKind,
  LAYER_KINDS,
  LAYER_META,
  type LayerKind,
  type LayerVisibility,
  parseJtParam,
  resolveWeekKey,
  serializeJtParam,
  shiftWeekKey,
  toChicagoWallMs,
  visibleHourRange,
  WEEK_MS,
} from "@/utils/jiating-calendar-view";
import CalendarLegend from "./CalendarLegend";
import SwimlaneView from "./SwimlaneView";
import { wallMonthDayFormatter } from "./shared";
import WeekGrid, { type HeatmapOverlay } from "./WeekGrid";

const STORAGE_KEY = "officer-calendar-jt";
const HEAT_SLOT_MINUTES = 30;

export type CalendarLayout = "week" | "lanes";

interface Props {
  events: CalendarSourceEvent[];
  families: CalendarFamily[];
  mixerFamiliesByEventId: Record<string, string[]>;
  /** Used as the default selection for parent-only users. */
  defaultFamilyId: string | null;
}

function readStoredJt(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredJt(value: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Storage blocked; the URL still carries the selection.
  }
}

function formatWeekLabel(weekStart: number) {
  const end = weekStart + WEEK_MS - 1;
  const year = new Date(end).getUTCFullYear();
  const startLabel = wallMonthDayFormatter.format(weekStart);
  const endLabel =
    new Date(weekStart).getUTCMonth() === new Date(end).getUTCMonth()
      ? String(new Date(end).getUTCDate())
      : wallMonthDayFormatter.format(end);
  return `${startLabel} – ${endLabel}, ${year}`;
}

const segmentButton = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
    active ? "bg-surface text-text shadow-sm" : "text-subtitle hover:text-text"
  }`;

const toolbarButton =
  "inline-flex items-center justify-center rounded-xl border border-home-border bg-surface px-3 py-2 text-sm font-semibold text-subtitle transition hover:border-primary/30 hover:text-text";

export default function JiatingCalendarView({
  events,
  families,
  mixerFamiliesByEventId,
  defaultFamilyId,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const familyIds = useMemo(() => families.map((f) => f.id), [families]);
  const familiesById = useMemo(
    () => new Map(families.map((f) => [f.id, f])),
    [families],
  );

  // ---- URL state -------------------------------------------------------
  const jtParam = searchParams.get("jt");
  const parsedJt = parseJtParam(jtParam, familyIds);
  const fallbackChecked = useMemo(
    () =>
      defaultFamilyId && familyIds.includes(defaultFamilyId)
        ? [defaultFamilyId]
        : familyIds,
    [defaultFamilyId, familyIds],
  );
  const checkedList = parsedJt ?? fallbackChecked;
  const checkedKey = checkedList.join(",");
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the joined ids
  const checked = useMemo(() => new Set(checkedList), [checkedKey]);
  const showCsa = searchParams.get(LAYER_META.csa.param) !== "0";
  const showOlympics = searchParams.get(LAYER_META.olympics.param) !== "0";
  const layers: LayerVisibility = useMemo(
    () => ({ csa: showCsa, olympics: showOlympics }),
    [showCsa, showOlympics],
  );
  const layout: CalendarLayout =
    searchParams.get("layout") === "lanes" ? "lanes" : "week";
  const showFree = searchParams.get("free") === "1";
  const weekKey = resolveWeekKey(searchParams.get("week"));
  const weekStart = dateKeyToWallMs(weekKey) ?? 0;

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      // Client-only URL update: the calendar needs no server data, and Next
      // keeps useSearchParams in sync with native history calls.
      // Keep `jt=a,b` readable instead of `a%2Cb`.
      const query = next.toString().replace(/%2C/gi, ",");
      window.history.replaceState(null, "", `${pathname}?${query}`);
    },
    [pathname, searchParams],
  );

  const setChecked = (ids: string[]) => {
    const ordered = familyIds.filter((id) => ids.includes(id));
    const value = serializeJtParam(ordered);
    writeStoredJt(value);
    updateParams({ jt: value });
  };

  // No usable `jt` in the URL (missing, or a stale link with no valid ids):
  // restore the last selection from this browser.
  const restoredRef = useRef(false);
  const jtUsable = parsedJt !== null;
  useEffect(() => {
    if (restoredRef.current || jtUsable) return;
    restoredRef.current = true;
    const stored = readStoredJt();
    if (stored === null) return;
    const ids = parseJtParam(stored, familyIds);
    if (ids) updateParams({ jt: serializeJtParam(ids) });
  }, [jtUsable, familyIds, updateParams]);

  // Client-only clock so server and client markup match.
  const [nowWall, setNowWall] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNowWall(toChicagoWallMs(new Date()));
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // ---- Derived data ----------------------------------------------------
  const allEntries = useMemo(
    () => buildCalendarEntries(events, families, mixerFamiliesByEventId),
    [events, families, mixerFamiliesByEventId],
  );
  const weekEntries = useMemo(
    () => entriesInRange(allEntries, weekStart, weekStart + WEEK_MS),
    [allEntries, weekStart],
  );
  const visible = useMemo(
    () => filterVisibleEntries(weekEntries, checked, layers),
    [weekEntries, checked, layers],
  );
  const conflicts = useMemo(
    () => findLayerConflicts(weekEntries, checked),
    [weekEntries, checked],
  );
  const conflictIds = useMemo(
    () => new Set(conflicts.flatMap((c) => [c.jiatingId, c.layerId])),
    [conflicts],
  );
  const { startHour, endHour } = visibleHourRange(visible, weekStart);
  // Lanes squeeze a whole week into one strip, so each day shows only its busy hours.
  const dayRanges = useMemo(
    () =>
      layout === "lanes" ? fitDayHourRanges(visible, weekStart) : undefined,
    [layout, visible, weekStart],
  );

  const heatmap: HeatmapOverlay | null = useMemo(() => {
    if (!showFree) return null;
    return {
      cells: buildBusyHeatmap({
        entries: weekEntries,
        checkedFamilyIds: checked,
        layers,
        weekStart,
        startHour,
        endHour,
        dayRanges,
        slotMinutes: HEAT_SLOT_MINUTES,
      }),
      slotMinutes: HEAT_SLOT_MINUTES,
      denominator:
        checked.size + LAYER_KINDS.filter((layer) => layers[layer]).length,
    };
  }, [
    showFree,
    weekEntries,
    checked,
    layers,
    weekStart,
    startHour,
    endHour,
    dayRanges,
  ]);

  const legendCounts = useMemo(() => {
    const counts: Record<string, number> = { csa: 0, olympics: 0 };
    for (const entry of weekEntries) {
      if (isLayerKind(entry.kind)) counts[entry.kind] += 1;
      for (const id of entry.familyIds) counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [weekEntries]);

  const entriesById = useMemo(
    () => new Map(allEntries.map((e) => [e.id, e])),
    [allEntries],
  );

  // ---- Popover and conflict list --------------------------------------
  const [selected, setSelected] = useState<{
    entry: CalendarEntry;
    anchor: DOMRect;
  } | null>(null);
  const [showConflicts, setShowConflicts] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;
    const close = () => setSelected(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onPointer = (e: PointerEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    // Defer so the click that opened the popover doesn't close it.
    const id = window.setTimeout(
      () => window.addEventListener("pointerdown", onPointer),
      0,
    );
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [selected]);

  // Close stale popovers when the week or selection changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on navigation
  useEffect(() => setSelected(null), [weekKey, layout, checkedKey, layers]);

  // Each week starts with the conflicts list closed, so an open list doesn't
  // reappear on its own in a later week that has conflicts.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on week change
  useEffect(() => setShowConflicts(false), [weekKey]);

  const onSelect = (entry: CalendarEntry, anchor: DOMRect) =>
    setSelected({ entry, anchor });

  const selectedConflicts = selected
    ? conflicts
        .filter(
          (c) =>
            c.jiatingId === selected.entry.id ||
            c.layerId === selected.entry.id,
        )
        .map((c) =>
          entriesById.get(
            c.jiatingId === selected.entry.id ? c.layerId : c.jiatingId,
          ),
        )
        .filter((e): e is CalendarEntry => Boolean(e))
    : [];

  const popoverPosition = (() => {
    if (!selected || typeof window === "undefined") return null;
    const width = Math.min(320, window.innerWidth - 32);
    const left = Math.min(
      Math.max(16, selected.anchor.left),
      window.innerWidth - width - 16,
    );
    const below = selected.anchor.bottom + 8;
    const placeAbove =
      below + 220 > window.innerHeight && selected.anchor.top > 240;
    return placeAbove
      ? { left, width, bottom: window.innerHeight - selected.anchor.top + 8 }
      : { left, width, top: below };
  })();

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <aside className="lg:sticky lg:top-6 lg:w-56 lg:shrink-0">
        <CalendarLegend
          families={families}
          checked={checked}
          onToggle={(id) =>
            setChecked(
              checked.has(id)
                ? checkedList.filter((x) => x !== id)
                : [...checkedList, id],
            )
          }
          onOnly={(id) => setChecked([id])}
          onSetAll={(all) => setChecked(all ? familyIds : [])}
          layers={layers}
          onToggleLayer={(layer: LayerKind) =>
            updateParams({
              [LAYER_META[layer].param]: layers[layer] ? "0" : null,
            })
          }
          counts={legendCounts}
        />
      </aside>

      <div className="min-w-0 flex-1">
        {/* Toolbar */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={toolbarButton}
              onClick={() => updateParams({ week: shiftWeekKey(weekKey, -1) })}
              aria-label="Previous week"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              className={toolbarButton}
              onClick={() => updateParams({ week: null })}
            >
              Today
            </button>
            <button
              type="button"
              className={toolbarButton}
              onClick={() => updateParams({ week: shiftWeekKey(weekKey, 1) })}
              aria-label="Next week"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
          <h2 className="mr-auto text-base font-bold text-text">
            {formatWeekLabel(weekStart)}
          </h2>

          {conflicts.length > 0 && (
            <button
              type="button"
              onClick={() => setShowConflicts((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-error-border bg-error-bg px-3 py-2 text-sm font-semibold text-error transition hover:border-error"
              aria-expanded={showConflicts}
            >
              <AlertTriangle className="size-4" aria-hidden />
              {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"}
            </button>
          )}

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-home-border bg-surface px-3 py-2 text-sm font-semibold text-subtitle">
            <input
              type="checkbox"
              checked={showFree}
              onChange={() => updateParams({ free: showFree ? null : "1" })}
              className="accent-primary"
            />
            Free time
          </label>

          <div
            className="inline-flex rounded-xl bg-surface-muted p-1"
            role="tablist"
            aria-label="Calendar layout"
          >
            <button
              type="button"
              role="tab"
              aria-selected={layout === "week"}
              onClick={() => updateParams({ layout: null })}
              className={segmentButton(layout === "week")}
            >
              <CalendarDays className="size-4" aria-hidden />
              Week
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={layout === "lanes"}
              onClick={() => updateParams({ layout: "lanes" })}
              className={segmentButton(layout === "lanes")}
            >
              <Rows3 className="size-4" aria-hidden />
              Lanes
            </button>
          </div>
        </div>

        {showConflicts && conflicts.length > 0 && (
          <div className="mb-3 rounded-2xl border border-error-border bg-error-bg p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-error">
                Jiating events overlapping CSA-wide or Jiating Olympics events
                this week
              </p>
              <button
                type="button"
                onClick={() => setShowConflicts(false)}
                className="rounded-lg p-1 text-error hover:bg-error/10"
                aria-label="Close conflicts"
              >
                <X className="size-4" />
              </button>
            </div>
            <ul className="flex flex-col gap-1 text-sm text-text">
              {conflicts.map((c) => {
                const jt = entriesById.get(c.jiatingId);
                const shared = entriesById.get(c.layerId);
                if (!jt || !shared) return null;
                return (
                  <li
                    key={`${c.jiatingId}-${c.layerId}`}
                    className="flex flex-wrap gap-x-1.5"
                  >
                    <Link
                      href={`/officer/events/${jt.id}`}
                      className="font-semibold hover:underline"
                    >
                      {jt.name}
                    </Link>
                    <span className="text-subtitle">overlaps</span>
                    <Link
                      href={`/officer/events/${shared.id}`}
                      className="font-semibold hover:underline"
                    >
                      {shared.name}
                    </Link>
                    <span className="text-subtitle">({shared.category})</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {showFree && (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtitle">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="size-3 rounded"
                style={{
                  background: "color-mix(in srgb, #10b981 30%, transparent)",
                }}
              />
              Open for every checked Jiating
              {LAYER_KINDS.filter((layer) => layers[layer])
                .map((layer) => ` and ${LAYER_META[layer].label}`)
                .join("")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-3 w-10 rounded"
                style={{
                  background:
                    "linear-gradient(to right, color-mix(in srgb, var(--theme-primary) 14%, transparent), color-mix(in srgb, var(--theme-primary) 50%, transparent))",
                }}
              />
              More Jiatings busy
            </span>
          </div>
        )}

        {layout === "week" ? (
          <WeekGrid
            entries={visible}
            weekStart={weekStart}
            startHour={startHour}
            endHour={endHour}
            familiesById={familiesById}
            conflictIds={conflictIds}
            heatmap={heatmap}
            nowWall={nowWall}
            onSelect={onSelect}
          />
        ) : (
          <SwimlaneView
            entries={visible}
            families={families}
            checked={checked}
            layers={layers}
            weekStart={weekStart}
            dayRanges={dayRanges ?? fitDayHourRanges(visible, weekStart)}
            familiesById={familiesById}
            conflictIds={conflictIds}
            heatmap={heatmap}
            nowWall={nowWall}
            onSelect={onSelect}
          />
        )}

        {visible.length === 0 && (
          <p className="mt-3 text-center text-sm text-subtitle">
            No events for the checked calendars this week.
          </p>
        )}
      </div>

      {selected && popoverPosition && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={selected.entry.name}
          className="fixed z-50 rounded-2xl border border-home-border bg-surface p-4 shadow-xl"
          style={popoverPosition}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-text">{selected.entry.name}</p>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="-m-1 rounded-lg p-1 text-subtitle hover:bg-bg hover:text-text"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-subtitle">
            {selected.entry.category}
            {selected.entry.publishStatus !== "published" &&
              ` · ${selected.entry.publishStatus[0].toUpperCase()}${selected.entry.publishStatus.slice(1)}`}
          </p>
          <p className="mt-2 text-xs text-text">
            {formatEventSchedule(
              selected.entry.startsAt,
              selected.entry.endsAt,
            )}
          </p>
          {selected.entry.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-subtitle">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{selected.entry.location}</span>
            </p>
          )}
          {selected.entry.familyIds.length > 0 && (
            <div className="mt-2 [&>div]:max-w-none [&>div]:justify-start">
              <EventJiatingPills
                families={selected.entry.familyIds
                  .map((id) => familiesById.get(id))
                  .filter((f): f is CalendarFamily => Boolean(f))}
              />
            </div>
          )}
          {selectedConflicts.length > 0 && (
            <div className="mt-3 rounded-xl border border-error-border bg-error-bg px-3 py-2 text-xs text-error">
              <p className="flex items-center gap-1 font-semibold">
                <AlertTriangle className="size-3.5" aria-hidden />
                Overlaps
              </p>
              <ul className="mt-1 list-inside list-disc">
                {selectedConflicts.map((other) => (
                  <li key={other.id}>
                    {other.name} ({other.category})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link
            href={`/officer/events/${selected.entry.id}`}
            className="mt-3 inline-flex rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition hover:bg-primary-hover"
          >
            Open event
          </Link>
        </div>
      )}
    </div>
  );
}
