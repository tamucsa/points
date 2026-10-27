"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import RewardTrackingTabs from "@/app/(dashboard)/(officer)/officer/rewards/components/RewardTrackingTabs";
import PageHeader from "@/app/components/PageHeader";
import {
  GM_REWARD_REQUIRED_CREDITS,
  GM_REWARD_REQUIRED_CSA_WIDE,
  type GmRewardMemberRow,
  gmRewardCsv,
} from "@/utils/rewards";

interface Props {
  semesterName: string | null;
  rows: GmRewardMemberRow[];
  error: string | null;
}

export default function RewardsClient({ semesterName, rows, error }: Props) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const qualifiedCount = rows.filter((row) => row.qualified).length;
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (!showAll && !row.qualified) return false;
      if (!needle) return true;
      return (
        row.fullName.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        (row.jtFamily ?? "").toLowerCase().includes(needle)
      );
    });
  }, [query, rows, showAll]);

  const download = () => {
    const csv = gmRewardCsv(visible);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = showAll ? "gm-reward-progress.csv" : "gm-reward.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <PageHeader
        title="Reward Tracking"
        subtitle={
          semesterName
        }
        className="mb-2"
      />

      <RewardTrackingTabs />

      <p className="mb-6 max-w-3xl text-sm leading-6 text-subtitle">
      Members who qualify for the Semi-Formals Discount must attend at least 3 General Meetings and 1 CSA-Wide event. GM credit can be made up through recap quizzes as well!
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-subtitle">
          <span className="font-semibold text-text">{qualifiedCount}</span>{" "}
          {qualifiedCount === 1 ? "member has" : "members have"} reached this reward
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, or Jiating"
            className="rounded-xl border border-home-border bg-surface px-3 py-2 text-sm text-text"
            aria-label="Search reward list"
          />
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="rounded-xl border border-home-border bg-surface px-4 py-2 text-sm font-semibold text-subtitle hover:text-text"
          >
            {showAll ? "Show reached only" : "Show all members"}
          </button>
          <button
            type="button"
            onClick={download}
            disabled={visible.length === 0}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-4xl border border-home-border bg-surface shadow-sm">
        {visible.length === 0 && (
          <p className="px-5 py-8 text-sm text-subtitle">
            {query.trim()
              ? "No members match this search."
              : showAll
                ? "No reward-eligible members in this semester."
                : "No members have reached this reward yet."}
          </p>
        )}
        {visible.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-2 border-b border-home-border px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <Link
                href={`/officer/members/${row.id}`}
                className="truncate text-sm font-semibold text-text hover:text-primary"
              >
                {row.fullName}
              </Link>
              <div className="mt-0.5 truncate text-xs text-subtitle">
                {row.email}
                {row.jtFamily ? ` · ${row.jtFamily}` : ""}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-bg px-2 py-1 font-medium text-text">
                GM {row.gmCredits}/{GM_REWARD_REQUIRED_CREDITS}
              </span>
              <span className="rounded-md bg-bg px-2 py-1 font-medium text-text">
                CSA-Wide {row.csaWideCount}/{GM_REWARD_REQUIRED_CSA_WIDE}
              </span>
              {row.qualified && (
                <span className="rounded-md bg-primary/10 px-2 py-1 font-semibold text-primary">
                  Reached
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
