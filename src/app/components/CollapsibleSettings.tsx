'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

type Props = {
  title: string
  summary?: string | null
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}

/** Simple disclosure panel for officer event settings. */
export default function CollapsibleSettings({
  title,
  summary,
  defaultOpen = false,
  children,
  className = '',
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`mt-5 rounded-2xl border border-home-border bg-bg ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text">{title}</div>
          {summary && !open && (
            <div className="mt-0.5 truncate text-xs text-subtitle">{summary}</div>
          )}
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-subtitle transition ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && <div className="space-y-3 border-t border-home-border px-4 py-3">{children}</div>}
    </div>
  )
}
