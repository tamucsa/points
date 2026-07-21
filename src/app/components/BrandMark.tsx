'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

const SIZES = {
  sm: 36,
  md: 48,
  lg: 64,
} as const

// Source files are 1500² with ~18% transparent padding around the circle.
const PAD_SCALE = 1500 / 1236

interface BrandMarkProps {
  size?: keyof typeof SIZES
  className?: string
  priority?: boolean
}

/** Theme-aware CSA mark using the transparent PNGs in /public as-is. */
export default function BrandMark({
  size = 'md',
  className = '',
  priority = false,
}: BrandMarkProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const slot = SIZES[size]
  const px = Math.round(slot * PAD_SCALE)
  const src =
    mounted && resolvedTheme === 'dark' ? '/logo-dark.png' : '/logo-light.png'

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-visible ${className}`}
      style={{ width: slot, height: slot }}
    >
      {/* Plain <img> — next/image's optimizer was palette-crushing these PNGs at small sizes */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Texas A&M CSA"
        width={px}
        height={px}
        decoding="async"
        {...(priority ? { fetchPriority: 'high' as const } : {})}
        className="max-w-none"
        style={{ width: px, height: px }}
      />
    </span>
  )
}
