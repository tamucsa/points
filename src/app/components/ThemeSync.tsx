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
 * One-shot sync between DB preference and next-themes / localStorage.
 * Does not overwrite an in-progress client toggle (that caused the theme to
 * appear stuck when revalidate remounted this component).
 */
export default function ThemeSync({ preference }: ThemeSyncProps) {
  const { setTheme } = useTheme()
  const synced = useRef(false)

  useEffect(() => {
    if (synced.current || !preference) return
    synced.current = true

    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null

    if (preference !== 'system') {
      if (stored !== preference) setTheme(preference)
      return
    }

    // DB still defaulting to system — keep any local choice and persist it once.
    if (stored && stored !== 'system') {
      void updateThemePreference(stored)
    }
  }, [preference, setTheme])

  return null
}
