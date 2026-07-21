'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useRef, useState } from 'react'
import { updateThemePreference } from '@/app/actions/theme'

type ThemePreference = 'light' | 'dark' | 'system'

const CYCLE: ThemePreference[] = ['light', 'dark', 'system']

const LABELS: Record<ThemePreference, string> = {
  light: 'Light mode',
  dark: 'Dark mode',
  system: 'System theme',
}

interface ThemeToggleProps {
  collapsed?: boolean
  persist?: boolean
  className?: string
}

export default function ThemeToggle({
  collapsed = false,
  persist = false,
  className = '',
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const schedulePersist = useCallback(
    (next: ThemePreference) => {
      if (!persist) return
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        void updateThemePreference(next)
      }, 300)
    },
    [persist],
  )

  const cycleTheme = () => {
    const current = (theme ?? 'system') as ThemePreference
    const index = CYCLE.indexOf(current)
    const next = CYCLE[(index + 1) % CYCLE.length]
    setTheme(next)
    schedulePersist(next)
  }

  const preference = mounted ? ((theme ?? 'system') as ThemePreference) : 'system'
  const Icon =
    !mounted || preference === 'system'
      ? Monitor
      : resolvedTheme === 'dark'
        ? Moon
        : Sun
  const label =
    preference === 'system' ? 'System' : preference === 'dark' ? 'Dark' : 'Light'

  return (
    <button
      type="button"
      onClick={cycleTheme}
      disabled={!mounted}
      aria-label={LABELS[preference]}
      title={LABELS[preference]}
      className={`inline-flex items-center justify-center text-xs text-subtitle/80 transition hover:text-text disabled:opacity-50 ${collapsed ? 'size-8' : 'gap-1.5 px-1 py-1'} ${className}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {!collapsed && <span>{label}</span>}
    </button>
  )
}
