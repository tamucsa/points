'use client'

import {
  JT_EVENT_MIXER_WEEKLY_ATTENDANCE_CAP,
  POINT_BUCKET_LABELS,
  SPORTS_SPECTATOR_SEMESTER_CAP,
} from '@/utils/constants'
import { isInCurrentChicagoWeek } from '@/utils/datetime'
import {
  CATEGORY_CONFIG,
  SPECTATOR_EVENT_CATEGORY,
  type EventCategory,
} from '@/utils/events'

const BUCKET_CATEGORIES: {
  bucket: (typeof POINT_BUCKET_LABELS)[keyof typeof POINT_BUCKET_LABELS]
  categories: Array<EventCategory | typeof SPECTATOR_EVENT_CATEGORY>
}[] = [
  {
    bucket: POINT_BUCKET_LABELS.csa,
    categories: ['CSA-Wide', 'CSA-Wide Mixers', 'Philanthropy', 'Concessions'],
  },
  {
    bucket: POINT_BUCKET_LABELS.jt,
    categories: ['Jiating Olympics', 'Jiating Event', 'Jiating Mixer'],
  },
  {
    bucket: POINT_BUCKET_LABELS.sports,
    categories: ['Sports', SPECTATOR_EVENT_CATEGORY, 'Dance'],
  },
  {
    bucket: POINT_BUCKET_LABELS.gm,
    categories: ['General Meeting'],
  },
]

function categoryPointValue(category: EventCategory | typeof SPECTATOR_EVENT_CATEGORY) {
  if (category === SPECTATOR_EVENT_CATEGORY) return 1
  return CATEGORY_CONFIG[category].pointValue
}

interface AttendanceLike {
  counted: boolean
  events: {
    category: string
    point_value: number
    starts_at: string
  }
}

interface Props {
  attendance: AttendanceLike[]
}

export default function PointsGuide({ attendance }: Props) {
  const spectatorCounted = attendance
    .filter(row => row.counted && row.events.category === SPECTATOR_EVENT_CATEGORY)
    .reduce((sum, row) => sum + (row.events.point_value ?? 0), 0)

  const weeklyJtMixerCounted = attendance.filter(
    row =>
      row.counted &&
      (row.events.category === 'Jiating Event' ||
        row.events.category === 'Jiating Mixer' ||
        row.events.category === 'Mixer') &&
      isInCurrentChicagoWeek(row.events.starts_at),
  ).length

  return (
    <div className="mb-8">
      <h2 className="mb-1 text-lg font-bold text-text">How points work</h2>
      <p className="mb-4 max-w-3xl text-sm leading-6 text-subtitle">
        Points come from attending events this semester. Totals above follow four leaderboard buckets;
        each event category has a fixed point value (Philanthropy can also include monetary opportunities
        with custom point amounts). Two caps can stop extra check-ins from counting
        toward your total — you&apos;ll still show as attended with a &ldquo;cap reached&rdquo; tag.
      </p>

      <div className="mb-4 overflow-hidden rounded-4xl border border-home-border bg-surface shadow-sm">
        <div className="border-b border-home-border bg-bg px-5 py-3 text-sm font-semibold text-text">
          Event categories
        </div>
        <div className="grid gap-px bg-home-border sm:grid-cols-2">
          {BUCKET_CATEGORIES.map(group => (
            <div key={group.bucket} className="bg-surface px-5 py-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-subtitle">
                Counts toward {group.bucket}
              </div>
              <ul className="space-y-2.5">
                {group.categories.map(category => (
                  <li
                    key={category}
                    className="flex items-center justify-between gap-3 text-sm leading-5 text-text"
                  >
                    <span className="min-w-0">{category}</span>
                    <span className="shrink-0 tabular-nums font-semibold text-primary">
                      {categoryPointValue(category)} pt
                      {categoryPointValue(category) === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-4xl border border-home-border bg-surface p-5 shadow-sm">
          <div className="text-sm font-semibold text-text">Sports Spectator cap</div>
          <p className="mt-2 text-sm leading-6 text-subtitle">
            Per semester, at most{' '}
            <span className="font-semibold text-text">{SPORTS_SPECTATOR_SEMESTER_CAP}</span>{' '}
            counting Sports Spectator points. Playing in a Sports event (not spectator) is separate
            and is not limited by this cap.
          </p>
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between text-xs text-subtitle">
              <span>This semester</span>
              <span className="font-semibold tabular-nums text-text">
                {spectatorCounted} / {SPORTS_SPECTATOR_SEMESTER_CAP} pts
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, (spectatorCounted / SPORTS_SPECTATOR_SEMESTER_CAP) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-4xl border border-home-border bg-surface p-5 shadow-sm">
          <div className="text-sm font-semibold text-text">Jiating Event + Jiating Mixer cap</div>
          <p className="mt-2 text-sm leading-6 text-subtitle">
            Each week (Monday–Sunday, Central time), at most{' '}
            <span className="font-semibold text-text">{JT_EVENT_MIXER_WEEKLY_ATTENDANCE_CAP}</span>{' '}
            counting Jiating Event or Jiating Mixer check-ins. Jiating Olympics and other categories are not
            included in this weekly limit.
          </p>
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between text-xs text-subtitle">
              <span>This week</span>
              <span className="font-semibold tabular-nums text-text">
                {weeklyJtMixerCounted} / {JT_EVENT_MIXER_WEEKLY_ATTENDANCE_CAP} events
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-bg">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (weeklyJtMixerCounted / JT_EVENT_MIXER_WEEKLY_ATTENDANCE_CAP) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
