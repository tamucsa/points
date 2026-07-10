'use client'

import { useRouter } from 'next/navigation'
import AccountLinkBadge from '@/app/(dashboard)/(officer)/officer/members/components/AccountLinkBadge'
import MemberAvatar from '@/app/components/MemberAvatar'
import { CATEGORY_COLORS, CHECKIN_METHOD_LABELS, POINT_BUCKET_LABELS } from '@/utils/constants'
import { formatEventSchedule } from '@/utils/datetime'

interface Member {
  id: string
  full_name: string
  email: string
  profile_image_url: string | null
  account_linked: boolean
  jt_family: string | null
  jt_color: string | null
  total_points: number
  csa_points: number
  jt_points: number
  sports_points: number
  gm_points: number
}

interface AttendanceRow {
  id: string
  check_in_method: string
  verified: boolean
  counted: boolean
  events: {
    name: string
    category: string
    point_value: number
    starts_at: string
    ends_at: string | null
  }
}

interface SemesterSummary {
  id: string
  total_points: number
  jt_family_name: string
  semesters: { name: string }
}

interface Props {
  member: Member
  attendance: AttendanceRow[]
  history: SemesterSummary[]
}

export default function MemberDetailClient({ member, attendance, history }: Props) {
  const router = useRouter()
  const color = member.jt_color ?? '#4779B8'
  const displayName = member.full_name

  const breakdown = [
    { label: POINT_BUCKET_LABELS.csa, value: member.csa_points },
    { label: POINT_BUCKET_LABELS.jt, value: member.jt_points },
    { label: POINT_BUCKET_LABELS.sports, value: member.sports_points },
    { label: POINT_BUCKET_LABELS.gm, value: member.gm_points },
  ]

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <button onClick={() => router.back()} className="mb-5 text-sm text-subtitle hover:text-primary">← Back</button>

      <div className="mb-6 flex flex-col gap-4 rounded-4xl border border-home-border bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <MemberAvatar
          name={displayName}
          profileImageUrl={member.profile_image_url}
          color={color}
          size="lg"
          bordered
        />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-text">{displayName}</h1>
            <AccountLinkBadge linked={member.account_linked} />
          </div>
          <p className="text-sm text-subtitle">{member.email}</p>
          {!member.account_linked && (
            <p className="mt-2 text-xs leading-5 text-amber-800">
              This member was imported on the roster but hasn&apos;t signed in with Google yet.
              They need to sign in once to link their account.
            </p>
          )}
          {member.jt_family && (
            <span className="mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${color}20`, color }}>
              {member.jt_family}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-5xl font-extrabold tracking-tight text-text">{member.total_points}</div>
          <div className="text-sm text-subtitle">total points</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {breakdown.map(cat => (
          <div key={cat.label} className="rounded-3xl border border-home-border bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-extrabold text-primary">{cat.value}</div>
            <div className="mt-1 text-xs text-subtitle">{cat.label}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 text-lg font-bold text-text">This Semester</h2>
      <div className="mb-6 overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
        {attendance.length === 0 && (
          <div className="px-8 py-10 text-center text-sm text-subtitle">No events attended yet.</div>
        )}
        {attendance.map(row => {
          const catColor = CATEGORY_COLORS[row.events?.category] ?? CATEGORY_COLORS.default
          return (
            <div key={row.id} className="flex items-center gap-4 border-b border-home-border px-5 py-3 last:border-b-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold" style={{ background: `${catColor}20`, color: catColor }}>
                {row.counted ? `+${row.events?.point_value}` : '—'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text">{row.events?.name}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-subtitle">
                  <span>{row.events?.starts_at ? formatEventSchedule(row.events.starts_at, row.events.ends_at) : '—'}</span>
                  <span className="rounded-md px-2 py-0.5" style={{ background: `${catColor}15`, color: catColor }}>{row.events?.category}</span>
                  {!row.counted && <span className="rounded-md bg-red-50 px-2 py-0.5 text-red-500">Cap reached</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {history.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-bold text-text">Past Semesters</h2>
          <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
            {history.map(sem => (
              <div key={sem.id} className="flex items-center justify-between border-b border-home-border px-5 py-4 last:border-b-0">
                <div>
                  <div className="text-sm font-medium text-text">{sem.semesters?.name}</div>
                  <div className="text-xs text-subtitle">{sem.jt_family_name}</div>
                </div>
                <div className="font-bold text-primary">{sem.total_points} pts</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
