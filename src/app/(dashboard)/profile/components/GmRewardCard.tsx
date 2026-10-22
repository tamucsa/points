import {
  GM_REWARD_REQUIRED_CREDITS,
  GM_REWARD_REQUIRED_CSA_WIDE,
  type GmRewardProgress,
  gmCreditLabel,
} from "@/utils/rewards";

interface Props {
  progress: GmRewardProgress;
  loadError?: string | null;
  /** Profile speaks to the member. Officer lookup speaks about them. */
  voice?: "self" | "member";
}

function Meter({
  label,
  value,
  required,
}: {
  label: string;
  value: number;
  required: number;
}) {
  const width = Math.min(100, (value / required) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs text-subtitle">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-text">
          {value} / {required}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

export default function GmRewardCard({
  progress,
  loadError = null,
  voice = "self",
}: Props) {
  return (
    <div className="mb-8 rounded-4xl border border-home-border bg-surface p-5 shadow-sm">
      <div className="text-sm font-semibold text-text">
        3 General Meetings reward
      </div>
      <p className="mt-2 text-sm leading-6 text-subtitle">
        This reward needs credit for {GM_REWARD_REQUIRED_CREDITS} General
        Meetings and attendance at {GM_REWARD_REQUIRED_CSA_WIDE} CSA-Wide event.
        A recap quiz counts as credit for that meeting and does not add points.
      </p>
      {loadError && (
        <p className="mt-2 text-sm text-red-600">
          Recap quiz credit could not be loaded, so this total may be missing
          quiz meetings.
        </p>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Meter
          label="General Meetings"
          value={progress.gmCredits}
          required={GM_REWARD_REQUIRED_CREDITS}
        />
        <Meter
          label="CSA-Wide events"
          value={progress.csaWideCount}
          required={GM_REWARD_REQUIRED_CSA_WIDE}
        />
      </div>
      {progress.qualified && (
        <p className="mt-4 text-sm font-semibold text-primary">
          {voice === "self"
            ? "You have reached this reward."
            : "This member has reached this reward."}
        </p>
      )}
      {progress.meetings.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm text-text">
          {progress.meetings.map((meeting) => (
            <li key={meeting.eventId} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{meeting.name}</span>
              <span className="shrink-0 text-xs text-subtitle">
                {gmCreditLabel(meeting.via)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
