'use client'

import { ChevronDown } from 'lucide-react'

export interface JiatingFamilyOption {
  id: string
  name: string
  color?: string | null
}

interface Props {
  families: JiatingFamilyOption[]
  value: string | null
  onChange: (familyId: string | null) => void
  counts?: Record<string, number>
  allCount?: number
  className?: string
}

export default function JiatingFamilyFilter({
  families,
  value,
  onChange,
  counts,
  allCount,
  className = 'mb-5',
}: Props) {
  if (families.length === 0) return null

  return (
    <div className={`flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 ${className}`}>
      <label
        htmlFor="jiating-family-filter"
        className="shrink-0 text-sm font-semibold text-subtitle"
      >
        Counts toward
      </label>
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <select
          id="jiating-family-filter"
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          className="w-full cursor-pointer appearance-none rounded-xl border border-home-border bg-surface py-2.5 pl-4 pr-10 text-sm font-semibold text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          aria-label="Filter by which Jiating events count toward"
        >
          <option value="">
            All families{typeof allCount === 'number' ? ` (${allCount})` : ''}
          </option>
          {families.map(family => {
            const count = counts?.[family.id]
            return (
              <option key={family.id} value={family.id}>
                {family.name}
                {typeof count === 'number' ? ` (${count})` : ''}
              </option>
            )
          })}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtitle"
          aria-hidden
        />
      </div>
    </div>
  )
}
