"use client";

import { FileText } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  clearGmRecapQuiz,
  dismissGmRecapRowAsGuest,
  type GmRecapRow,
  matchGmRecapRow,
  replaceGmRecapQuiz,
} from "@/app/actions/recap";
import { inputClassName } from "@/utils/constants";
import { parseRecapQuizCsv } from "@/utils/rewards";

interface MatchMember {
  id: string;
  full_name: string;
  email: string;
}

interface Props {
  eventId: string;
  initialRows: GmRecapRow[];
  attendedMemberIds: string[];
  matchMembers: MatchMember[];
  btnPrimaryClassName: string;
  btnSecondaryClassName: string;
}

export default function RecapQuizPanel({
  eventId,
  initialRows,
  attendedMemberIds,
  matchMembers,
  btnPrimaryClassName,
  btnSecondaryClassName,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState(initialRows);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [matchDraft, setMatchDraft] = useState<Record<string, string>>({});

  const attended = useMemo(
    () => new Set(attendedMemberIds),
    [attendedMemberIds],
  );
  const unmatched = useMemo(
    () => rows.filter((row) => !row.member_id && !row.is_guest),
    [rows],
  );
  const guests = useMemo(() => rows.filter((row) => row.is_guest), [rows]);
  const matched = useMemo(
    () => rows.filter((row) => row.member_id && !row.is_guest),
    [rows],
  );
  const alsoCheckedIn = matched.filter((row) =>
    row.member_id ? attended.has(row.member_id) : false,
  ).length;
  const hasUpload = rows.length > 0;

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setMessage({ type: "error", text: "Please upload a .csv file." });
      return;
    }

    setSelectedFile(file);
    setMessage(null);

    try {
      const text = await file.text();
      const parsed = parseRecapQuizCsv(text);

      if (parsed.rows.length === 0) {
        const clearConfirm = window.confirm(
          hasUpload
            ? "This CSV has no school-email rows. Clear the recap quiz for this meeting? Check-ins and points stay as they are."
            : "This CSV has no school-email rows to import.",
        );
        if (!hasUpload || !clearConfirm) {
          if (!hasUpload) {
            setMessage({
              type: "error",
              text: "CSV has no @tamu.edu or @buc.blinn.edu rows to import.",
            });
          }
          return;
        }
        setUploading(true);
        const clearResult = await clearGmRecapQuiz(eventId);
        if (!clearResult.success) {
          setMessage({
            type: "error",
            text: clearResult.error ?? "Failed to clear the recap quiz.",
          });
          return;
        }
        setMessage({ type: "success", text: "Recap quiz cleared." });
        window.location.reload();
        return;
      }

      if (hasUpload) {
        const replace = window.confirm(
          "Replace the recap quiz for this meeting? Matched credit will be updated. Check-ins and points stay as they are.",
        );
        if (!replace) return;
      }

      setUploading(true);
      const result = await replaceGmRecapQuiz(eventId, parsed.rows);
      if (!result.success) {
        setMessage({
          type: "error",
          text: result.error ?? "Failed to upload the recap quiz.",
        });
        return;
      }

      const skippedNote =
        result.skipped > 0
          ? ` ${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped.`
          : "";
      setMessage({
        type: "success",
        text: `Saved ${result.matched} matched and ${result.unmatched} unmatched.${skippedNote}`,
      });
      window.location.reload();
    } catch {
      setMessage({ type: "error", text: "Could not read that CSV." });
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    const step1 = window.confirm(
      "Clear the recap quiz for this meeting? Check-ins and points stay as they are.",
    );
    if (!step1) return;
    setClearing(true);
    const result = await clearGmRecapQuiz(eventId);
    setClearing(false);
    if (!result.success) {
      setMessage({
        type: "error",
        text: result.error ?? "Failed to clear the recap quiz.",
      });
      return;
    }
    setRows([]);
    setMessage({ type: "success", text: "Recap quiz cleared." });
  };

  const handleMatch = async (rowId: string) => {
    const memberId = matchDraft[rowId];
    if (!memberId) return;
    setBusyId(rowId);
    const result = await matchGmRecapRow(rowId, memberId);
    setBusyId(null);
    if (!result.success) {
      setMessage({
        type: "error",
        text: result.error ?? "Failed to match this row.",
      });
      return;
    }
    const member = matchMembers.find((item) => item.id === memberId);
    setRows((current) =>
      current.map((row) =>
        row.id === rowId
          ? {
              ...row,
              member_id: memberId,
              is_guest: false,
              member_name: member?.full_name ?? row.member_name,
            }
          : row,
      ),
    );
    setMessage(null);
  };

  const handleGuest = async (rowId: string) => {
    setBusyId(rowId);
    const result = await dismissGmRecapRowAsGuest(rowId);
    setBusyId(null);
    if (!result.success) {
      setMessage({
        type: "error",
        text: result.error ?? "Failed to mark this row as a guest.",
      });
      return;
    }
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, member_id: null, is_guest: true } : row,
      ),
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-subtitle">
        Upload the quiz responses. A matched member gets credit for this General
        Meeting and no points. Someone who also checked in keeps their
        attendance points, and the meeting still counts once toward the reward.
      </p>
      <p className="text-xs leading-5 text-subtitle">
        CSV columns: <span className="font-medium text-text">Email</span> and{" "}
        <span className="font-medium text-text">Name</span>. School emails only
        (@tamu.edu or @buc.blinn.edu). Re-upload replaces this quiz.
      </p>

      {hasUpload && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-subtitle">
            Current list: {matched.length} matched · {unmatched.length}{" "}
            unmatched · {guests.length} guest{guests.length === 1 ? "" : "s"}
            {alsoCheckedIn > 0 ? ` · ${alsoCheckedIn} also checked in` : ""}
          </p>
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={uploading || clearing}
            className={btnSecondaryClassName}
          >
            {clearing ? "Clearing…" : "Clear quiz"}
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          void handleFile(file);
        }}
      />

      <button
        type="button"
        disabled={uploading}
        aria-label="Upload recap quiz CSV"
        onClick={() => fileRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (uploading) return;
          void handleFile(event.dataTransfer.files?.[0] ?? null);
        }}
        className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center font-[inherit] transition ${
          uploading
            ? "cursor-not-allowed border-home-border bg-surface opacity-70"
            : dragActive
              ? "border-primary bg-primary/5"
              : "border-home-border bg-surface hover:border-primary/40"
        }`}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <FileText className="size-6 text-primary" aria-hidden />
        </div>
        {uploading ? (
          <p className="text-sm font-medium text-text">Uploading…</p>
        ) : (
          <>
            <p className="text-sm font-medium text-text">
              {selectedFile
                ? selectedFile.name
                : "Drag and drop the quiz CSV here"}
            </p>
            <p className="mt-1 text-xs text-subtitle">
              or <span className="font-medium text-primary">browse files</span>
              {hasUpload ? " to replace" : ""}
            </p>
          </>
        )}
      </button>

      {message && (
        <p
          className={`text-sm ${
            message.type === "success" ? "text-green-700" : "text-red-600"
          }`}
        >
          {message.text}
        </p>
      )}

      {unmatched.length > 0 && (
        <div className="space-y-2 border-t border-home-border/80 pt-3">
          <div className="text-sm font-semibold text-text">
            Unmatched emails
          </div>
          <p className="text-xs text-subtitle">
            Match to a member or mark as guest. Guests do not get meeting
            credit.
          </p>
          <ul className="space-y-2">
            {unmatched.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-home-border bg-surface px-3 py-2.5"
              >
                <div className="text-sm font-medium text-text">
                  {row.full_name || "—"}
                </div>
                <div className="text-xs text-subtitle">{row.email}</div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    className={`${inputClassName} sm:flex-1`}
                    value={matchDraft[row.id] ?? ""}
                    onChange={(event) =>
                      setMatchDraft((draft) => ({
                        ...draft,
                        [row.id]: event.target.value,
                      }))
                    }
                    aria-label={`Match ${row.email}`}
                  >
                    <option value="">Match to member…</option>
                    {matchMembers.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} ({member.email})
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={btnPrimaryClassName}
                      disabled={!matchDraft[row.id] || busyId === row.id}
                      onClick={() => void handleMatch(row.id)}
                    >
                      {busyId === row.id ? "…" : "Match"}
                    </button>
                    <button
                      type="button"
                      className={btnSecondaryClassName}
                      disabled={busyId === row.id}
                      onClick={() => void handleGuest(row.id)}
                    >
                      Guest
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {guests.length > 0 && (
        <div className="space-y-1 border-t border-home-border/80 pt-3">
          <div className="text-sm font-semibold text-text">Guests</div>
          <ul className="text-xs text-subtitle">
            {guests.map((guest) => (
              <li key={guest.id}>
                {guest.full_name || "—"} · {guest.email}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
