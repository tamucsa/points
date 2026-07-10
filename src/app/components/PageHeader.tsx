import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: ReactNode
  className?: string
}

export default function PageHeader({
  title,
  subtitle,
  className = 'mb-6',
}: PageHeaderProps) {
  return (
    <div className={className}>
      <h1 className="text-3xl font-bold tracking-tight text-text">{title}</h1>
      {subtitle != null && subtitle !== '' && (
        <p className="mt-1 text-sm text-subtitle">{subtitle}</p>
      )}
    </div>
  )
}
