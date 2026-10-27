"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import RewardTrackingTabs from "@/app/(dashboard)/(officer)/officer/rewards/components/RewardTrackingTabs";
import { setBattlePassPickup } from "@/app/actions/battle-pass";
import PageHeader from "@/app/components/PageHeader";
import {
  type BattlePassReward,
  type BattlePassTrackingRow,
  summarizeBattlePass,
} from "@/utils/battle-pass";

interface Props {
  semesterName: string | null;
  rewards: BattlePassReward[];
  rows: BattlePassTrackingRow[];
  error: string | null;
}

function cellKey(memberId: string, rewardId: string) {
  return `${memberId}:${rewardId}`;
}

export default function BattlePassTrackingClient({
  semesterName,
  rewards,
  rows: initialRows,
  error,
}: Props) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [needsPickup, setNeedsPickup] = useState(true);
  const [rewardId, setRewardId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const summary = useMemo(
    () => summarizeBattlePass(rewards, rows),
    [rewards, rows],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (needle) {
        const haystack =
          `${row.fullName} ${row.email} ${row.jtFamily ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (rewardId) {
        const cell = row.rewards.find((reward) => reward.rewardId === rewardId);
        if (!cell) return false;
        if (needsPickup) return cell.eligible && !cell.pickedUp;
        return cell.eligible || cell.pickedUp;
      }
      if (needsPickup) {
        return row.rewards.some(
          (reward) => reward.eligible && !reward.pickedUp,
        );
      }
      return true;
    });
  }, [needsPickup, query, rewardId, rows]);

  const toggle = async (
    row: BattlePassTrackingRow,
    reward: BattlePassTrackingRow["rewards"][number],
  ) => {
    const key = cellKey(row.id, reward.rewardId);
    setPendingKey(key);
    setActionError(null);
    const nextPickedUp = !reward.pickedUp;
    const result = await setBattlePassPickup({
      rewardId: reward.rewardId,
      memberId: row.id,
      pickedUp: nextPickedUp,
    });
    setPendingKey(null);
    if (!result.success) {
      setActionError(result.error ?? "Failed to update pickup.");
      return;
    }
    setRows((current) =>
      current.map((item) => {
        if (item.id !== row.id) return item;
        return {
          ...item,
          rewards: item.rewards.map((cell) =>
            cell.rewardId === reward.rewardId
              ? { ...cell, pickedUp: nextPickedUp }
              : cell,
          ),
        };
      }),
    );
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
        Once a member gets enough points, they can redeem their reward!
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {actionError && (
        <p className="mb-4 text-sm text-red-600">{actionError}</p>
      )}

      {summary.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {summary.map((reward) => {
            const selected = rewardId === reward.id;
            return (
              <button
                key={reward.id}
                type="button"
                onClick={() => setRewardId(selected ? null : reward.id)}
                className={`rounded-2xl border px-3 py-2 text-left text-xs transition ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-home-border bg-surface text-subtitle hover:border-primary/30"
                }`}
                aria-pressed={selected}
              >
                <span className="block font-semibold text-text">
                  {reward.name}
                </span>
                <span className="mt-0.5 block">
                  {reward.pickedUp} picked up · {reward.eligible} eligible ·{" "}
                  {reward.pointsRequired} pts
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-subtitle">
          <span className="font-semibold text-text">{visible.length}</span>{" "}
          {visible.length === 1 ? "member" : "members"}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, or Jiating"
            className="rounded-xl border border-home-border bg-surface px-3 py-2 text-sm text-text"
            aria-label="Search battle pass list"
          />
          <button
            type="button"
            onClick={() => setNeedsPickup((value) => !value)}
            className="rounded-xl border border-home-border bg-surface px-4 py-2 text-sm font-semibold text-subtitle hover:text-text"
          >
            {needsPickup ? "Show all members" : "Show ready for pickup"}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-4xl border border-home-border bg-surface shadow-sm">
        {rewards.length === 0 && !error && (
          <p className="px-5 py-8 text-sm text-subtitle">
            No battle pass rewards are set for this semester. Add them in Admin
            → Semesters.
          </p>
        )}
        {rewards.length > 0 && visible.length === 0 && (
          <p className="px-5 py-8 text-sm text-subtitle">
            {query.trim()
              ? "No members match this search."
              : needsPickup
                ? "No members are waiting to pick up a reward."
                : "No reward-eligible members in this semester."}
          </p>
        )}
        {rewards.length > 0 &&
          visible.map((row) => (
            <div
              key={row.id}
              className="border-b border-home-border px-5 py-4 last:border-b-0"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
                <div className="shrink-0 text-sm font-semibold tabular-nums text-text">
                  {row.totalPoints} pts
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {row.rewards.map((reward) => {
                  const key = cellKey(row.id, reward.rewardId);
                  const pending = pendingKey === key;
                  const highlighted = rewardId === reward.rewardId;
                  if (reward.pickedUp) {
                    return (
                      <div
                        key={reward.rewardId}
                        className={`inline-flex items-center gap-2 rounded-xl bg-primary/10 px-2.5 py-1.5 text-xs ${
                          highlighted ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        <span className="font-semibold text-primary">
                          {reward.name} · Claimed
                        </span>
                        <button
                          type="button"
                          className="font-semibold text-subtitle underline decoration-subtitle/40 hover:text-text disabled:opacity-60"
                          disabled={pending}
                          onClick={() => void toggle(row, reward)}
                        >
                          {pending ? "Saving…" : "Undo"}
                        </button>
                      </div>
                    );
                  }
                  if (!reward.eligible) {
                    const remaining = reward.pointsRequired - row.totalPoints;
                    return (
                      <span
                        key={reward.rewardId}
                        className={`inline-flex rounded-xl bg-bg px-2.5 py-1.5 text-xs font-medium text-subtitle ${
                          highlighted ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        {reward.name} · {remaining} to go
                      </span>
                    );
                  }
                  return (
                    <button
                      key={reward.rewardId}
                      type="button"
                      disabled={pending}
                      onClick={() => void toggle(row, reward)}
                      className={`rounded-xl border border-primary/30 bg-surface px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-60 ${
                        highlighted ? "ring-2 ring-primary" : ""
                      }`}
                    >
                      {pending ? "Saving…" : `${reward.name}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
