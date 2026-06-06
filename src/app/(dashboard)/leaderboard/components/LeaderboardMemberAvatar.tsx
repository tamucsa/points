interface Props {
  name: string
  profileImageUrl: string | null
  jtColor: string | null
  size?: 'sm' | 'md'
}

export default function LeaderboardMemberAvatar({
  name,
  profileImageUrl,
  jtColor,
  size = 'sm',
}: Props) {
  const color = jtColor ?? '#4779B8'
  const sizeClass = size === 'md' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs'

  if (profileImageUrl) {
    return (
      <img
        src={profileImageUrl}
        alt={name}
        className={`${sizeClass} shrink-0 rounded-full border border-home-border object-cover`}
      />
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${sizeClass}`}
      style={{ background: `${color}20`, color }}
    >
      {name[0]}
    </div>
  )
}
