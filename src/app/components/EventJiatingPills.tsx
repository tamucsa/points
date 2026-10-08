import JtFamilyBadge from '@/app/(dashboard)/leaderboard/components/JtFamilyBadge'
import type { EventJiatingFamily } from '@/utils/events'

export default function EventJiatingPills({
  families,
}: {
  families: EventJiatingFamily[]
}) {
  if (families.length === 0) return null

  return (
    <div
      className="flex max-w-[14rem] shrink-0 flex-wrap justify-end gap-1"
      aria-label="Participating Jiatings"
    >
      {families.map(family => (
        <JtFamilyBadge key={family.id} name={family.name} color={family.color} />
      ))}
    </div>
  )
}
