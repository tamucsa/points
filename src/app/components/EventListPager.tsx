'use client'

import { EVENTS_PAGE_SIZE } from '@/utils/constants'

interface Props {
  page: number
  totalCount: number
  onPageChange: (page: number) => void
  pageSize?: number
  className?: string
}

export function paginateItems<T>(items: T[], page: number, pageSize = EVENTS_PAGE_SIZE) {
  const totalCount = items.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    page: safePage,
    totalPages,
    totalCount,
    items: items.slice(start, start + pageSize),
    rangeStart: totalCount === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, totalCount),
  }
}

export default function EventListPager({
  page,
  totalCount,
  onPageChange,
  pageSize = EVENTS_PAGE_SIZE,
  className = 'mt-4',
}: Props) {
  if (totalCount <= pageSize) return null

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const rangeStart = (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, totalCount)

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <p className="text-sm text-subtitle">
        Showing {rangeStart}–{rangeEnd} of {totalCount}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="rounded-xl border border-home-border bg-white px-3 py-2 text-sm font-medium text-subtitle transition hover:border-primary/30 hover:text-text disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          className="rounded-xl border border-home-border bg-white px-3 py-2 text-sm font-medium text-subtitle transition hover:border-primary/30 hover:text-text disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
