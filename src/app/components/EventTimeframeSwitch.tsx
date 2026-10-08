'use client'

import type { ReactNode } from 'react'

export type EventTimeframe = 'upcoming' | 'past'

interface Props {
  value: EventTimeframe
  onChange: (value: EventTimeframe) => void
  upcomingCount: number
  pastCount: number
}

const OPTIONS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
] as const

export default function EventTimeframeSwitch({
  value,
  onChange,
  upcomingCount,
  pastCount,
}: Props) {
  const counts: Record<EventTimeframe, number> = {
    upcoming: upcomingCount,
    past: pastCount,
  }

  return (
    <div
      className="inline-flex shrink-0 rounded-xl bg-surface-muted p-1"
      role="tablist"
      aria-label="Upcoming or past events"
    >
      {OPTIONS.map(option => {
        const active = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              active
                ? 'bg-surface text-text shadow-sm'
                : 'text-subtitle hover:text-text'
            }`}
          >
            {option.label}
            <span className={`ml-1.5 tabular-nums ${active ? 'text-primary' : 'text-subtitle/70'}`}>
              {counts[option.id]}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function LogAttendancePanel({ children }: { children: ReactNode }) {
  return (
    <section
      className="mb-6 rounded-3xl border border-home-border bg-surface-muted px-4 py-5 sm:px-5"
      aria-label="Log Attendance"
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text">Log Attendance</h2>
        <p className="mt-1 text-sm text-subtitle">
          These events might need attendance logged. Dismiss if needed.
        </p>
      </div>
      {children}
    </section>
  )
}
