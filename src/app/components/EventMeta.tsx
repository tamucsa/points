import type { ReactNode } from 'react'

/** Metadata row under an event title — consistent horizontal & vertical gaps when wrapping */
export function EventMetaRow({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-subtitle ${className}`}
    >
      {children}
    </div>
  )
}

/** Icon + text metadata (time, location, attendance count) */
export function EventMetaItem({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-6 items-center leading-none">{children}</span>
  )
}

/** Pill-style label (category, scope, check-in type) */
export function EventMetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-6 items-center rounded-md bg-bg px-2 text-[11px] leading-none text-subtitle">
      {children}
    </span>
  )
}
