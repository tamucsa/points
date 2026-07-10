interface Props {
  linked: boolean
  compact?: boolean
}

export default function AccountLinkBadge({ linked, compact = false }: Props) {
  if (linked) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-green-50 font-medium text-green-700 ${
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
        }`}
      >
        Signed in
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center rounded-full bg-amber-50 font-medium text-amber-800 ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
      }`}
    >
      Not signed in
    </span>
  )
}
