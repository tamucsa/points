"use client";

import { useEffect, useState } from "react";
import { updateSemesterPointsCutoff } from "@/app/actions/semesters";
import {
  eventTimestampToFormDate,
  eventTimestampToFormTime,
} from "@/utils/event-times";
import { formatPointsCutoff } from "@/utils/points-cutoff";

const inputClass =
  "rounded-xl border border-home-border bg-surface px-3 py-2.5 text-text shadow-sm";
const btnPrimary =
  "rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition disabled:cursor-not-allowed disabled:bg-disabled";
const btnSecondary =
  "rounded-xl border border-home-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-primary/40 disabled:opacity-60";

export default function PointsCutoffEditor({
  semesterId,
  pointsCutoffAt,
  onChange,
  onMessage,
}: {
  semesterId: string;
  pointsCutoffAt: string | null;
  onChange: (pointsCutoffAt: string | null) => void;
  onMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    setDate(pointsCutoffAt ? eventTimestampToFormDate(pointsCutoffAt) : "");
    setTime(pointsCutoffAt ? eventTimestampToFormTime(pointsCutoffAt) : "");
  }, [pointsCutoffAt]);

  const save = async (next: { date: string; time: string }) => {
    setSaving(true);
    onMessage(null);
    const result = await updateSemesterPointsCutoff({
      id: semesterId,
      date: next.date,
      time: next.time,
    });
    setSaving(false);
    if (!result.success) {
      onMessage({
        type: "error",
        text: result.error ?? "Failed to save points cutoff.",
      });
      return;
    }
    onChange(result.pointsCutoffAt);
    setEditing(false);
    onMessage({
      type: "success",
      text: result.pointsCutoffAt
        ? `Points cutoff set to ${formatPointsCutoff(result.pointsCutoffAt)}. Everyone's points were recalculated.`
        : "Points cutoff cleared. Everyone's points were recalculated.",
    });
  };

  const handleClear = () => {
    if (
      !window.confirm(
        "Clear the points cutoff? Events after it will start earning points again.",
      )
    ) {
      return;
    }
    void save({ date: "", time: "" });
  };

  return (
    <div className="border-t border-home-border/80 pt-4 mb-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-text">Points cutoff</h4>
        {!editing && (
          <div className="flex gap-2">
            <button
              type="button"
              className={btnSecondary}
              disabled={saving}
              onClick={() => setEditing(true)}
            >
              {pointsCutoffAt ? "Change" : "Set cutoff"}
            </button>
            {pointsCutoffAt && (
              <button
                type="button"
                className="rounded-xl border border-red-200 bg-surface px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 disabled:opacity-60"
                disabled={saving}
                onClick={handleClear}
              >
                {saving ? "Clearing…" : "Clear"}
              </button>
            )}
          </div>
        )}
      </div>

      {!editing && (
        <p className="text-sm text-subtitle">
          {pointsCutoffAt ? (
            <>
              Events starting at or after{" "}
              <span className="font-medium text-text">
                {formatPointsCutoff(pointsCutoffAt)}
              </span>{" "}
              (Central) earn no points. Attendance is still recorded.
            </>
          ) : (
            "No cutoff. Every event this semester earns points."
          )}
        </p>
      )}

      {editing && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ date, time });
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-text">Date</span>
            <input
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-text">Time (Central)</span>
            <input
              type="time"
              className={inputClass}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </label>
          <p className="text-xs leading-5 text-subtitle sm:col-span-2">
            Decided by each event&apos;s start time. An event that starts
            exactly at the cutoff earns no points, so set this to
            Semi-Formals&apos; start time to leave it out. Admins can mark
            single events as Always count or Never count on the event page.
          </p>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? "Saving…" : "Save cutoff"}
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setDate(
                  pointsCutoffAt
                    ? eventTimestampToFormDate(pointsCutoffAt)
                    : "",
                );
                setTime(
                  pointsCutoffAt
                    ? eventTimestampToFormTime(pointsCutoffAt)
                    : "",
                );
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
