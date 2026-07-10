'use client'

import { useEffect, useState } from 'react'

const SIZE_CLASSES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-2xl',
} as const

interface Props {
  name: string
  profileImageUrl?: string | null
  color?: string | null
  size?: keyof typeof SIZE_CLASSES
  bordered?: boolean
  className?: string
}

export default function MemberAvatar({
  name,
  profileImageUrl,
  color,
  size = 'sm',
  bordered = false,
  className = '',
}: Props) {
  const [imageError, setImageError] = useState(false)
  const fallbackColor = color ?? '#4779B8'
  const sizeClass = SIZE_CLASSES[size]

  useEffect(() => {
    setImageError(false)
  }, [profileImageUrl])

  const showImage = profileImageUrl && !imageError

  if (showImage) {
    return (
      <img
        src={profileImageUrl}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full object-cover ${bordered ? 'border border-home-border' : ''} ${className}`}
        onError={() => setImageError(true)}
      />
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${sizeClass} ${className}`}
      style={{ background: `${fallbackColor}20`, color: fallbackColor }}
      aria-hidden
    >
      {name[0] ?? '?'}
    </div>
  )
}
