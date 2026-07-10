import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

interface Props {
  href?: string
  onClick?: () => void
  label?: string
  className?: string
}

export default function BackLink({
  href,
  onClick,
  label = 'Back',
  className = 'mb-4 inline-flex items-center gap-1 text-sm text-subtitle transition hover:text-primary',
}: Props) {
  const content = (
    <>
      <ChevronLeft className="size-4 shrink-0" aria-hidden />
      <span>{label}</span>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  )
}
