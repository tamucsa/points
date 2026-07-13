import type { LucideIcon } from 'lucide-react'

interface AuthFeatureCardProps {
  icon: LucideIcon
  title: string
  description: string
  accent?: boolean
}

export default function AuthFeatureCard({
  icon: Icon,
  title,
  description,
  accent = false,
}: AuthFeatureCardProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-home-border bg-white/85 p-4 shadow-sm">
      <div
        className={`mb-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          accent ? 'bg-accent/15' : 'bg-primary/10'
        }`}
      >
        <Icon className={`size-4 ${accent ? 'text-accent' : 'text-primary'}`} aria-hidden />
      </div>
      <div className={`text-sm font-semibold ${accent ? 'text-accent' : 'text-primary'}`}>
        {title}
      </div>
      <p className="mt-1 text-sm leading-snug text-subtitle">{description}</p>
    </div>
  )
}
