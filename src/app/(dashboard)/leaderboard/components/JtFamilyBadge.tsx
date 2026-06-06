interface Props {
  name: string
  color: string | null
}

export default function JtFamilyBadge({ name, color }: Props) {
  const jtColor = color ?? '#4779B8'

  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: `${jtColor}20`, color: jtColor }}
    >
      {name}
    </span>
  )
}
