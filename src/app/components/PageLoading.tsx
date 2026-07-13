import { Loader2 } from 'lucide-react'

interface PageLoadingProps {
  label?: string
  className?: string
}

export default function PageLoading({
  label = 'Loading…',
  className = 'flex min-h-[50vh] items-center justify-center',
}: PageLoadingProps) {
  return (
    <div className={className} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-subtitle">{label}</p>
      </div>
    </div>
  )
}
