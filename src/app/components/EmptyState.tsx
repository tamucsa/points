import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
  /** Inline empty row inside a table/card (no outer border) */
  compact?: boolean
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  className = '',
  compact = false,
}: EmptyStateProps) {
  if (compact) {
    return (
      <div className={`px-8 py-10 text-center ${className}`}>
        <Icon className="mx-auto size-8 text-subtitle/50" aria-hidden />
        <p className="mt-3 text-sm text-subtitle">{title}</p>
        {description && (
          <p className="mt-1 text-xs leading-5 text-subtitle/80">{description}</p>
        )}
      </div>
    )
  }

  return (
    <div
      className={`rounded-4xl border border-home-border bg-white px-10 py-12 text-center shadow-sm ${className}`}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="size-6 text-primary/70" aria-hidden />
      </div>
      <p className="mt-4 text-sm font-medium text-text">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-subtitle">{description}</p>
      )}
    </div>
  )
}
