"use client";

import { useEffect, useState } from "react";
import {
  createBattlePassReward,
  deleteBattlePassReward,
  updateBattlePassReward,
} from "@/app/actions/battle-pass";
import {
  type BattlePassReward,
  sortBattlePassRewards,
} from "@/utils/battle-pass";

const inputClass =
  "rounded-xl border border-home-border bg-surface px-3 py-2.5 text-text shadow-sm";
const btnSecondary =
  "rounded-xl border border-home-border bg-surface px-3 py-2 text-sm font-medium text-text transition hover:border-primary/40 disabled:opacity-60";
const btnPrimary =
  "rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition disabled:cursor-not-allowed disabled:bg-disabled";

export default function BattlePassRewardsEditor({
  semesterId,
  rewards,
  onChange,
  onMessage,
}: {
  semesterId: string;
  rewards: BattlePassReward[];
  onChange: (rewards: BattlePassReward[]) => void;
  onMessage: (msg: { type: "success" | "error"; text: string } | null) => void;
}) {
  const [items, setItems] = useState(rewards);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", points: "" });
  const [adding, setAdding] = useState(false);
  const [newReward, setNewReward] = useState({ name: "", points: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setItems(rewards);
  }, [rewards]);

  const publish = (next: BattlePassReward[]) => {
    const sorted = sortBattlePassRewards(next);
    setItems(sorted);
    onChange(sorted);
  };

  const beginEdit = (reward: BattlePassReward) => {
    setAdding(false);
    setEditingId(reward.id);
    setDraft({ name: reward.name, points: String(reward.pointsRequired) });
  };

  const handleSave = async () => {
    if (!editingId) return;
    const pointsText = draft.points.trim();
    if (!draft.name.trim() || !/^\d+$/.test(pointsText)) {
      onMessage({
        type: "error",
        text: "Enter a reward name and a whole number of points from 0 to 10000.",
      });
      return;
    }
    const pointsRequired = Number(pointsText);
    setBusy(true);
    onMessage(null);
    const result = await updateBattlePassReward({
      id: editingId,
      name: draft.name,
      pointsRequired,
    });
    setBusy(false);
    if (!result.success) {
      onMessage({
        type: "error",
        text: result.error ?? "Failed to save reward.",
      });
      return;
    }
    publish(
      items.map((reward) =>
        reward.id === editingId
          ? {
              ...reward,
              name: draft.name.trim().replace(/\s+/g, " "),
              pointsRequired,
            }
          : reward,
      ),
    );
    setEditingId(null);
    onMessage({ type: "success", text: "Reward updated." });
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    onMessage(null);
    const result = await createBattlePassReward({
      semesterId,
      name: newReward.name,
      pointsRequired: Number(newReward.points),
    });
    setBusy(false);
    if (!result.success || !result.reward) {
      onMessage({
        type: "error",
        text: result.error ?? "Failed to save reward.",
      });
      return;
    }
    publish([...items, result.reward]);
    setAdding(false);
    setNewReward({ name: "", points: "" });
    onMessage({ type: "success", text: `Added "${result.reward.name}".` });
  };

  const handleRemove = async (reward: BattlePassReward) => {
    if (
      !window.confirm(
        `Remove "${reward.name}"? Pickup records for this reward will be deleted.`,
      )
    ) {
      return;
    }
    setBusy(true);
    onMessage(null);
    const result = await deleteBattlePassReward(reward.id);
    setBusy(false);
    if (!result.success) {
      onMessage({
        type: "error",
        text: result.error ?? "Failed to remove reward.",
      });
      return;
    }
    publish(items.filter((item) => item.id !== reward.id));
    if (editingId === reward.id) setEditingId(null);
    onMessage({ type: "success", text: `Removed "${reward.name}".` });
  };

  return (
    <div className="border-t border-home-border/80 pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-text">
            Battle pass rewards
          </h4>
          <p className="mt-1 text-xs leading-5 text-subtitle">
            Members unlock a reward when their points this semester reach the
            threshold.
          </p>
        </div>
        {!adding && !editingId && (
          <button
            type="button"
            className={btnSecondary}
            disabled={busy}
            onClick={() => {
              setAdding(true);
              setNewReward({ name: "", points: "" });
            }}
          >
            Add reward
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {items.map((reward) => (
          <li
            key={reward.id}
            className="rounded-2xl border border-home-border bg-surface px-3 py-2.5"
          >
            {editingId === reward.id ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="flex flex-1 flex-col gap-1 text-sm">
                  <span className="font-medium text-text">Reward name</span>
                  <input
                    className={inputClass}
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label className="flex w-full flex-col gap-1 text-sm sm:w-32">
                  <span className="font-medium text-text">Points</span>
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    max={10000}
                    step={1}
                    value={draft.points}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        points: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={busy}
                    onClick={() => void handleSave()}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text">
                    {reward.name}
                  </div>
                  <div className="text-xs text-subtitle">
                    {reward.pointsRequired} points
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={busy}
                    onClick={() => beginEdit(reward)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-red-200 bg-surface px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 disabled:opacity-60"
                    disabled={busy}
                    onClick={() => void handleRemove(reward)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-subtitle">
            No battle pass rewards for this semester yet.
          </li>
        )}
      </ul>

      {adding && (
        <form
          onSubmit={(event) => void handleAdd(event)}
          className="mt-3 flex flex-col gap-2 rounded-2xl border border-dashed border-home-border bg-surface p-3 sm:flex-row sm:items-end"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="font-medium text-text">Reward name</span>
            <input
              className={inputClass}
              value={newReward.name}
              onChange={(event) =>
                setNewReward((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="CSA Sticker"
              required
            />
          </label>
          <label className="flex w-full flex-col gap-1 text-sm sm:w-32">
            <span className="font-medium text-text">Points</span>
            <input
              className={inputClass}
              type="number"
              min={0}
              max={10000}
              step={1}
              value={newReward.points}
              onChange={(event) =>
                setNewReward((current) => ({
                  ...current,
                  points: event.target.value,
                }))
              }
              required
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className={btnPrimary} disabled={busy}>
              Add
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={busy}
              onClick={() => setAdding(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
