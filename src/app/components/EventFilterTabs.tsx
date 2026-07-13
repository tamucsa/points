'use client'

import {
  EVENT_FILTER_TABS,
  type EventFilterTabId,
} from '@/utils/events'

interface Props {
  value: EventFilterTabId
  onChange: (value: EventFilterTabId) => void
  counts?: Partial<Record<EventFilterTabId, number>>
  className?: string
}

export default function EventFilterTabs({
  value,
  onChange,
  counts,
  className = 'mb-5',
}: Props) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-1 ${className}`}
      role="tablist"
      aria-label="Filter events"
    >
      {EVENT_FILTER_TABS.map(tab => {
        const active = tab.id === value
        const count = counts?.[tab.id]
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-home-border bg-white text-subtitle hover:border-primary/30 hover:text-text'
            }`}
          >
            {tab.label}
            {typeof count === 'number' && (
              <span className={`ml-1.5 ${active ? 'text-primary/70' : 'text-subtitle/80'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
