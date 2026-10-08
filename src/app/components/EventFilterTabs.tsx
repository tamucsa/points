'use client'

import type { ReactNode } from 'react'
import {
  EVENT_FILTER_TABS,
  type EventFilterTabId,
} from '@/utils/events'

interface Props {
  value: EventFilterTabId
  onChange: (value: EventFilterTabId) => void
  counts?: Partial<Record<EventFilterTabId, number>>
  className?: string
  trailing?: ReactNode
}

export default function EventFilterTabs({
  value,
  onChange,
  counts,
  className = 'mb-5',
  trailing,
}: Props) {
  return (
    <div className={`border-b border-home-border ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div
          className="-mb-px flex min-w-0 flex-1 gap-1 overflow-x-auto"
          role="tablist"
          aria-label="Filter events by category"
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
              className={`relative shrink-0 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-subtitle hover:text-text'
              }`}
            >
              {tab.label}
              {typeof count === 'number' && (
                <span className={`ml-1.5 tabular-nums ${active ? 'text-primary/70' : 'text-subtitle/70'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
        </div>
        {trailing && <div className="pb-2 sm:pl-3">{trailing}</div>}
      </div>
    </div>
  )
}
