'use client'

import { useTheme } from 'next-themes'
import { useEffect, useRef } from 'react'
import { THEME_STORAGE_KEY } from '@/app/components/ThemeProvider'
import { updateThemePreference } from '@/app/actions/theme'

type ThemePreference = 'light' | 'dark' | 'system'

interface ThemeSyncProps {
  preference: ThemePreference | null | undefined
}

/**
 * Seed theme from DB only when this browser has no saved choice.
 * Never overwrite localStorage — that was fighting the toggle.
 */
export default function ThemeSync({ preference }: ThemeSyncProps) {
  const { setTheme } = useTheme()
  const synced = useRef(false)

  useEffect(() => {
    if (synced.current || !preference) return
    synced.current = true

    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored) {
      if (preference === 'system' && stored !== 'system') {
        void updateThemePreference(stored as ThemePreference)
      }
      return
    }

    if (preference !== 'system') {
      setTheme(preference)
    }
  }, [preference, setTheme])

  return null
}
