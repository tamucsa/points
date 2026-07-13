'use client'

export interface JiatingFamilyOption {
  id: string
  name: string
  color?: string | null
}

interface Props {
  families: JiatingFamilyOption[]
  value: string | null
  onChange: (familyId: string | null) => void
  counts?: Record<string, number>
  allCount?: number
  className?: string
}

export default function JiatingFamilyFilter({
  families,
  value,
  onChange,
  counts,
  allCount,
  className = 'mb-5',
}: Props) {
  if (families.length === 0) return null

  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-1 ${className}`}
      role="tablist"
      aria-label="Filter by Jiating"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        onClick={() => onChange(null)}
        className={`shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
          value === null
            ? 'border-primary bg-primary/10 text-primary'
            : 'border-home-border bg-white text-subtitle hover:border-primary/30 hover:text-text'
        }`}
      >
        All
        {typeof allCount === 'number' && (
          <span className={`ml-1.5 ${value === null ? 'text-primary/70' : 'text-subtitle/80'}`}>
            {allCount}
          </span>
        )}
      </button>
      {families.map(family => {
        const active = value === family.id
        const count = counts?.[family.id]
        return (
          <button
            key={family.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(family.id)}
            className={`shrink-0 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-home-border bg-white text-subtitle hover:border-primary/30 hover:text-text'
            }`}
          >
            {family.color && (
              <span
                className="mr-1.5 inline-block size-2 rounded-full align-middle"
                style={{ backgroundColor: family.color }}
                aria-hidden
              />
            )}
            {family.name}
            {typeof count === 'number' && (
              <span className={`ml-1.5 ${active ? 'text-primary/70' : 'text-subtitle/80'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
