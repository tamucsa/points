"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateEventPointsException } from "@/app/actions/events";
import {
  eventEarnsPoints,
  formatPointsCutoff,
  POINTS_EXCEPTION_OPTIONS,
  type PointsException,
  parsePointsException,
} from "@/utils/points-cutoff";

/** Admin-only: let one event ignore the semester points cutoff. */
export default function PointsExceptionPanel({
  eventId,
  startsAt,
  initialException,
  pointsCutoffAt,
  btnPrimaryClassName,
}: {
  eventId: string;
  startsAt: string;
  initialException: string | null;
  pointsCutoffAt: string | null;
  btnPrimaryClassName: string;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<PointsException>(
    parsePointsException(initialException),
  );
  const [value, setValue] = useState<PointsException>(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const earns = eventEarnsPoints(
    { starts_at: startsAt, points_exception: saved },
    pointsCutoffAt,
  );

  const save = async () => {
    setSaving(true);
    setError(null);
    setDone(false);
    const result = await updateEventPointsException(eventId, value);
    setSaving(false);
    if (!result.success) {
      setError(result.error ?? "Failed to save points setting.");
      return;
    }
    setSaved(result.pointsException);
    setDone(true);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-subtitle">
        {pointsCutoffAt
          ? `Semester points cutoff: ${formatPointsCutoff(pointsCutoffAt)} (Central).`
          : "No points cutoff is set for this semester."}{" "}
        This event{" "}
        <span className="font-medium text-text">
          {earns ? "earns points" : "earns no points"}
        </span>
        .
      </p>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Points setting</legend>
        {POINTS_EXCEPTION_OPTIONS.map((option) => (
          <label
            key={option.value ?? "follow"}
            className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-home-border bg-surface px-3 py-2.5"
          >
            <input
              type="radio"
              name={`points-exception-${eventId}`}
              className="mt-0.5"
              checked={value === option.value}
              onChange={() => {
                setValue(option.value);
                setDone(false);
              }}
              disabled={saving}
            />
            <span>
              <span className="font-medium text-text">{option.label}</span>
              <span className="block text-xs text-subtitle">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btnPrimaryClassName}
          disabled={saving || value === saved}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save points setting"}
        </button>
        {done && (
          <span className="text-xs text-green-700">
            Saved. Points were recalculated.
          </span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
