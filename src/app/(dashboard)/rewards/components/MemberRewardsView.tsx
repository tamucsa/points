import { Check, Gift, Lock } from "lucide-react";
import PageHeader from "@/app/components/PageHeader";
import type { BattlePassProgressItem } from "@/utils/battle-pass";

interface CatalogReward {
  id: string;
  name: string;
  pointsRequired: number;
}

interface Progress {
  items: BattlePassProgressItem[];
  next: BattlePassProgressItem | null;
  reachedCount: number;
}

interface Props {
  semesterName: string | null;
  rewards: CatalogReward[];
  progress: Progress | null;
  points: number | null;
  loadError: string | null;
}

type RewardState = "claimed" | "eligible" | "locked" | "catalog";

function rewardState(
  item: BattlePassProgressItem,
  hasProgress: boolean,
): RewardState {
  if (!hasProgress) return "catalog";
  if (item.pickedUp) return "claimed";
  if (item.eligible) return "eligible";
  return "locked";
}

function statusLabel(state: RewardState, item: BattlePassProgressItem) {
  if (state === "claimed") return "Claimed";
  if (state === "eligible") return "Eligible";
  if (state === "locked") return `${item.pointsToGo} to go`;
  return `${item.pointsRequired} points`;
}

function statusDetail(state: RewardState, item: BattlePassProgressItem) {
  if (state === "claimed") return "An officer recorded this pickup.";
  if (state === "eligible")
    return "You can claim this. Ask an officer to record the pickup.";
  if (state === "locked") {
    const noun = item.pointsToGo === 1 ? "point" : "points";
    return `${item.pointsToGo} more ${noun} to unlock.`;
  }
  return "Dues-paying members unlock this when their semester points reach the threshold.";
}

const BADGE: Record<RewardState, string> = {
  claimed: "bg-primary/10 text-primary",
  eligible: "bg-primary text-on-primary",
  locked: "bg-surface-muted text-subtitle",
  catalog: "bg-surface-muted text-subtitle",
};

const NODE: Record<RewardState, string> = {
  claimed: "border-primary bg-primary text-on-primary",
  eligible: "border-primary bg-surface text-primary shadow-theme-primary",
  locked: "border-home-border bg-surface-muted text-subtitle",
  catalog: "border-home-border bg-surface text-primary",
};

const CARD: Record<RewardState, string> = {
  claimed: "border-primary/30 bg-primary/5",
  eligible: "border-primary bg-surface shadow-theme-sm",
  locked: "border-home-border bg-surface",
  catalog: "border-home-border bg-surface",
};

function StatusIcon({ state }: { state: RewardState }) {
  if (state === "claimed") return <Check className="size-4" aria-hidden />;
  if (state === "locked") return <Lock className="size-4" aria-hidden />;
  return <Gift className="size-4" aria-hidden />;
}

function NameChips({
  items,
  empty,
}: {
  items: BattlePassProgressItem[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-subtitle">{empty}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-full border border-home-border bg-surface px-3 py-1 text-sm font-semibold text-text"
        >
          {item.name}
        </li>
      ))}
    </ul>
  );
}

function SeasonTrack({
  points,
  items,
}: {
  points: number;
  items: BattlePassProgressItem[];
}) {
  const max = Math.max(...items.map((item) => item.pointsRequired), 1);
  const width = Math.min(100, (points / max) * 100);

  return (
    <div
      className="relative mt-6 h-2 rounded-full bg-surface"
      role="img"
      aria-label={`${points} of ${max} points toward the highest reward`}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-primary"
        style={{ width: `${width}%` }}
      />
      {items.map((item) => {
        const left = (item.pointsRequired / max) * 100;
        return (
          <span
            key={item.id}
            className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
              item.pickedUp
                ? "border-primary bg-primary"
                : item.eligible
                  ? "border-primary bg-surface"
                  : "border-home-border bg-surface"
            }`}
            style={{ left: `${left}%` }}
          />
        );
      })}
    </div>
  );
}

export default function MemberRewardsView({
  semesterName,
  rewards,
  progress,
  points,
  loadError,
}: Props) {
  const items: BattlePassProgressItem[] =
    progress?.items ??
    rewards.map((reward) => ({
      ...reward,
      eligible: false,
      pickedUp: false,
      pointsToGo: reward.pointsRequired,
    }));
  const hasProgress = progress != null;
  const claimed = items.filter((item) => item.pickedUp);
  const eligible = items.filter((item) => item.eligible);
  const next = progress?.next ?? null;
  const allClaimed =
    hasProgress && items.length > 0 && claimed.length === items.length;

  let headline = "Earn points this semester to unlock each reward.";
  if (hasProgress && allClaimed) {
    headline = "You claimed every reward this semester.";
  } else if (hasProgress && !next) {
    headline =
      "You are eligible for every reward. Pick up the ones still open.";
  } else if (hasProgress && next) {
    const noun = next.pointsToGo === 1 ? "point" : "points";
    headline = `${next.pointsToGo} more ${noun} until ${next.name}.`;
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <PageHeader
        title="Rewards"
        subtitle={semesterName ? `${semesterName} battle pass` : "Battle pass"}
      />

      {loadError && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {loadError}
        </p>
      )}

      {!semesterName && (
        <p className="rounded-4xl border border-home-border bg-surface px-5 py-8 text-sm text-subtitle">
          No active semester yet.
        </p>
      )}

      {semesterName && items.length === 0 && !loadError && (
        <p className="rounded-4xl border border-home-border bg-surface px-5 py-8 text-sm text-subtitle">
          No battle pass rewards are set for this semester yet.
        </p>
      )}

      {semesterName && items.length > 0 && hasProgress && (
        <section className="overflow-hidden rounded-4xl border border-home-border bg-hero-gradient p-6 shadow-theme-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtitle">
                Your points
              </p>
              <p className="mt-2 text-6xl font-bold leading-none tracking-tight text-text tabular-nums">
                {points ?? 0}
              </p>
            </div>
            <dl className="flex gap-3">
              <div className="min-w-24 rounded-3xl border border-home-border bg-surface px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-subtitle">
                  Eligible
                </dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-text">
                  {eligible.length}
                  <span className="text-base font-semibold text-subtitle">
                    /{items.length}
                  </span>
                </dd>
              </div>
              <div className="min-w-24 rounded-3xl border border-home-border bg-surface px-4 py-3">
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-subtitle">
                  Claimed
                </dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-text">
                  {claimed.length}
                  <span className="text-base font-semibold text-subtitle">
                    /{items.length}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <p className="mt-5 max-w-xl text-sm leading-6 text-text">
            {headline}
          </p>
          <SeasonTrack points={points ?? 0} items={items} />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-semibold text-text">Eligible</p>
              <NameChips
                items={eligible}
                empty="None yet. Keep earning points."
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-text">Claimed</p>
              <NameChips
                items={claimed}
                empty="None yet. Eligible rewards can be picked up."
              />
            </div>
          </div>
        </section>
      )}

      {semesterName && items.length > 0 && !hasProgress && (
        <p className="mb-6 max-w-xl text-sm leading-6 text-subtitle">
          Make sure to contact the Secretary to claim your rewards!
        </p>
      )}

      {semesterName && items.length > 0 && (
        <ol className={hasProgress ? "mt-8" : ""}>
          {items.map((item, index) => {
            const state = rewardState(item, hasProgress);
            const fill = hasProgress
              ? Math.min(
                  100,
                  ((points ?? 0) / Math.max(item.pointsRequired, 1)) * 100,
                )
              : 0;
            const isNext = next?.id === item.id;
            const isLast = index === items.length - 1;

            return (
              <li key={item.id} className="flex gap-4">
                <div className="flex w-11 shrink-0 flex-col items-center">
                  <div
                    className={`flex size-11 items-center justify-center rounded-full border-2 ${NODE[state]}`}
                  >
                    <StatusIcon state={state} />
                  </div>
                  {!isLast && (
                    <div
                      className={`my-1 w-px flex-1 ${
                        item.eligible ? "bg-primary/40" : "bg-home-border"
                      }`}
                      aria-hidden
                    />
                  )}
                </div>
                <article
                  className={`mb-4 min-w-0 flex-1 rounded-3xl border px-5 py-4 ${CARD[state]} ${
                    isLast ? "mb-0" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-subtitle">
                        {item.pointsRequired} points
                        {isNext ? " · Next" : ""}
                      </p>
                      <h2 className="mt-1 text-2xl leading-none text-text">
                        {item.name}
                      </h2>
                    </div>
                    {state !== "catalog" && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${BADGE[state]}`}
                      >
                        {statusLabel(state, item)}
                      </span>
                    )}
                  </div>
                  {hasProgress && (
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-bg">
                      <div
                        className={`h-full rounded-full ${
                          state === "locked" ? "bg-primary/50" : "bg-primary"
                        }`}
                        style={{ width: `${fill}%` }}
                      />
                    </div>
                  )}
                  {state !== "catalog" && (
                    <p className="mt-3 text-sm leading-6 text-subtitle">
                      {statusDetail(state, item)}
                    </p>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
