"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { replaceGmCultureQuiz } from "@/app/actions/culture-quiz";
import { inputClassName } from "@/utils/constants";
import {
  CULTURE_QUIZ_PLACES,
  type CultureQuizPlace,
  cultureQuizPlaceLabel,
  cultureQuizPoints,
} from "@/utils/culture-quiz";
import { isParent } from "@/utils/members";

export interface CultureQuizResultRow {
  memberId: string;
  fullName: string;
  place: CultureQuizPlace;
  points: number;
}

interface Attendee {
  memberId: string;
  fullName: string;
  role: string;
  isParent?: boolean;
}

interface Props {
  eventId: string;
  initialRows: CultureQuizResultRow[];
  attendees: Attendee[];
  attendanceLoadError?: string | null;
  btnPrimaryClassName: string;
  btnSecondaryClassName: string;
}

function groupByPlace(rows: CultureQuizResultRow[]) {
  const grouped: Record<CultureQuizPlace, string[]> = { 1: [], 2: [], 3: [] };
  for (const row of rows) {
    if (!grouped[row.place].includes(row.memberId)) {
      grouped[row.place].push(row.memberId);
    }
  }
  return grouped;
}

export default function CultureQuizPanel({
  eventId,
  initialRows,
  attendees,
  attendanceLoadError = null,
  btnPrimaryClassName,
  btnSecondaryClassName,
}: Props) {
  const router = useRouter();
  const initialKey = initialRows
    .map((row) => `${row.memberId}:${row.place}`)
    .sort()
    .join("|");
  const [syncedKey, setSyncedKey] = useState(initialKey);
  const [byPlace, setByPlace] = useState(() => groupByPlace(initialRows));
  if (syncedKey !== initialKey) {
    setSyncedKey(initialKey);
    setByPlace(groupByPlace(initialRows));
  }
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of initialRows) map.set(row.memberId, row.fullName);
    for (const attendee of attendees) {
      map.set(attendee.memberId, attendee.fullName);
    }
    return map;
  }, [attendees, initialRows]);

  const taken = useMemo(() => {
    const ids = new Set<string>();
    for (const place of CULTURE_QUIZ_PLACES) {
      for (const memberId of byPlace[place]) ids.add(memberId);
    }
    return ids;
  }, [byPlace]);

  const eligible = useMemo(() => {
    const seen = new Set<string>();
    const rows: { memberId: string; fullName: string }[] = [];
    for (const attendee of attendees) {
      if (seen.has(attendee.memberId)) continue;
      seen.add(attendee.memberId);
      if (
        isParent({
          role: attendee.role,
          is_parent: attendee.isParent,
        })
      ) {
        continue;
      }
      rows.push({
        memberId: attendee.memberId,
        fullName: attendee.fullName,
      });
    }
    rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
    return rows;
  }, [attendees]);

  const addMember = (place: CultureQuizPlace, memberId: string) => {
    if (!memberId || taken.has(memberId)) return;
    setByPlace((current) => ({
      ...current,
      [place]: [...current[place], memberId],
    }));
    setMessage(null);
  };

  const removeMember = (place: CultureQuizPlace, memberId: string) => {
    setByPlace((current) => ({
      ...current,
      [place]: current[place].filter((id) => id !== memberId),
    }));
    setMessage(null);
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const rows = CULTURE_QUIZ_PLACES.flatMap((place) =>
      byPlace[place].map((memberId) => ({ memberId, place })),
    );
    const result = await replaceGmCultureQuiz(eventId, rows);
    setSaving(false);
    if (!result.success) {
      setMessage({
        type: "error",
        text: result.error ?? "Failed to save the Culture Quiz.",
      });
      return;
    }
    setMessage({ type: "success", text: "Culture Quiz saved." });
    router.refresh();
  };

  if (attendanceLoadError) {
    return (
      <p className="text-sm text-red-600">
        Could not load attendance, so Culture Quiz places cannot be saved.
        Refresh the page to try again.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-subtitle">
        Pick 1st, 2nd, and 3rd from members who checked in. A shared place gives
        each person the same points: 3, 2, and 1. Those points are added on top
        of the General Meeting check-in. Parents are left off this list. An
        empty place is fine.
      </p>

      {eligible.length === 0 && taken.size === 0 && (
        <p className="text-sm text-subtitle">
          Check members in before recording the Culture Quiz.
        </p>
      )}

      {CULTURE_QUIZ_PLACES.map((place) => {
        const points = cultureQuizPoints(place);
        const label = cultureQuizPlaceLabel(place);
        const available = eligible.filter(
          (member) => !taken.has(member.memberId),
        );
        return (
          <div key={place} className="space-y-2">
            <div className="text-sm font-semibold text-text">
              {label}{" "}
              <span className="font-medium text-subtitle">
                · {points} point{points === 1 ? "" : "s"} each
              </span>
            </div>
            {byPlace[place].length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {byPlace[place].map((memberId) => (
                  <li key={memberId}>
                    <button
                      type="button"
                      onClick={() => removeMember(place, memberId)}
                      className="rounded-full border border-home-border bg-surface px-3 py-1 text-sm text-text transition hover:border-error hover:text-error"
                    >
                      {names.get(memberId) ?? "Member"}{" "}
                      <span aria-hidden>×</span>
                      <span className="sr-only">Remove from {label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <select
              aria-label={`Add a member to ${label}`}
              className={inputClassName}
              value=""
              disabled={available.length === 0}
              onChange={(event) => addMember(place, event.target.value)}
            >
              <option value="">
                {available.length === 0
                  ? "No one left to add"
                  : "Add someone who checked in…"}
              </option>
              {available.map((member) => (
                <option key={member.memberId} value={member.memberId}>
                  {member.fullName}
                </option>
              ))}
            </select>
          </div>
        );
      })}

      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-green-700" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className={btnPrimaryClassName}
        >
          {saving ? "Saving…" : "Save Culture Quiz"}
        </button>
        <button
          type="button"
          onClick={() => {
            setByPlace({ 1: [], 2: [], 3: [] });
            setMessage(null);
          }}
          disabled={saving || taken.size === 0}
          className={btnSecondaryClassName}
        >
          Clear places
        </button>
      </div>
    </div>
  );
}
