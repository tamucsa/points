'use client'

import { useMemo, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'csa-dismissed-zero-attendance'

let cached = '[]'
let loaded = false
const listeners = new Set<() => void>()

function readStoredIds() {
  if (typeof window === 'undefined') return '[]'
  if (!loaded) {
    loaded = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      cached = JSON.stringify(Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : [])
    } catch {
      cached = '[]'
    }
  }
  return cached
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useDismissedAttendanceEventIds() {
  const raw = useSyncExternalStore(subscribe, readStoredIds, () => '[]')
  return useMemo(() => JSON.parse(raw) as string[], [raw])
}

export function dismissAttendancePin(eventId: string) {
  const current = new Set(JSON.parse(readStoredIds()) as string[])
  if (current.has(eventId)) return
  current.add(eventId)
  cached = JSON.stringify([...current])
  localStorage.setItem(STORAGE_KEY, cached)
  for (const listener of listeners) listener()
}
