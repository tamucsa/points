'use client'

import { POINT_BUCKET_LABELS } from '@/utils/constants'
import { formatEventSchedule } from '@/utils/datetime'
import JtFamilyBadge from '@/app/(dashboard)/leaderboard/components/JtFamilyBadge'
import MemberAvatar from '@/app/components/MemberAvatar'
import EmptyState from '@/app/components/EmptyState'
import PageHeader from '@/app/components/PageHeader'
import PointsGuide from '@/app/(dashboard)/profile/components/PointsGuide'
import { AlertCircle, Calendar } from 'lucide-react'

interface Member {
  id: string
  full_name: string
  profile_image_url: string | null
  graduation_year: number | null
}

interface Points {
  total_points: number
  csa_points: number
  jt_points: number
  sports_points: number
  gm_points: number
  jt_family: string | null
  jt_color: string | null
}

interface AttendanceRow {
  id: string
  recorded_at: string
  check_in_method: string
  counted: boolean
  events: {
    name: string
    category: string
    point_value: number
    starts_at: string
    ends_at: string | null
  }
}

interface SemmarySummary {
  id: string
  total_points: number
  jt_family_name: string
  semesters: { name: string }
}

interface Props {
  member: Member
  points: Points | null
  attendance: AttendanceRow[]
  history: SemmarySummary[]
  semesterName: string | null
  pointsLoadError?: string | null
  attendanceLoadError?: string | null
  historyLoadError?: string | null
}

const CATEGORY_COLORS: Record<string, string> = {
  'CSA-Wide':          '#4f6ef7',
  'Jiating Olympics':  '#f7934f',
  Sports:              '#4fc787',
  'General Meeting':   '#e8b84b',
  default:             '#888',
}

const CHECKIN_LABELS: Record<string, string> = {
  officer: 'Officer',
  qr_scan: 'QR Scan',
  self:    'Self',
}

export default function ProfileClient({
  member,
  points,
  attendance,
  history,
  semesterName,
  pointsLoadError = null,
  attendanceLoadError = null,
  historyLoadError = null,
}: Props) {
  const displayName = member.full_name
  const color = points?.jt_color ?? '#4779B8'

  const breakdown = [
    { label: `${POINT_BUCKET_LABELS.csa} Points`, value: points?.csa_points ?? 0, color: CATEGORY_COLORS['CSA-Wide'] },
    { label: `${POINT_BUCKET_LABELS.jt} Points`, value: points?.jt_points ?? 0, color: CATEGORY_COLORS['Jiating Olympics'] },
    { label: `${POINT_BUCKET_LABELS.sports} Points`, value: points?.sports_points ?? 0, color: CATEGORY_COLORS.Sports },
    { label: `${POINT_BUCKET_LABELS.gm} Points`, value: points?.gm_points ?? 0, color: CATEGORY_COLORS['General Meeting'] },
  ]

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <PageHeader
        title="My Points"
        subtitle={semesterName ?? 'Current Semester'}
        className="mb-6"
      />

      {/* Profile card */}
      <div className="mb-8 flex flex-col gap-5 rounded-4xl border border-home-border bg-white p-6 shadow-sm sm:flex-row sm:items-center">
        <MemberAvatar
          name={displayName}
          profileImageUrl={member.profile_image_url}
          color={color}
          size="lg"
          bordered
        />
        <div className="flex-1">
          <div className="text-2xl font-bold text-text">{displayName}</div>
          {points?.jt_family && (
            <div className="mt-2">
              <JtFamilyBadge name={points.jt_family} color={points.jt_color} />
            </div>
          )}
          {member.graduation_year && (
            <div className="mt-2 text-sm text-subtitle">
              Class of {member.graduation_year}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-5xl font-extrabold tracking-[-2px] text-text">
            {pointsLoadError ? '—' : (points?.total_points ?? 0)}
          </div>
          <div className="text-sm text-subtitle">total points</div>
        </div>
      </div>

      {pointsLoadError && (
        <div className="mb-8 overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
          <EmptyState
            icon={AlertCircle}
            title="Couldn’t load points"
            description="Refresh the page to try again."
            compact
          />
        </div>
      )}

      {/* Point Breakdown */}
      {!pointsLoadError && (
        <div className="mb-8">
          <h2 className="mb-1 text-lg font-bold text-text">
            Point Breakdown
          </h2>
          <p className="mb-3 text-sm text-subtitle">
            Your earned totals by leaderboard bucket this semester.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {breakdown.map(cat => (
              <div key={cat.label} className="rounded-3xl border border-home-border bg-white p-4 text-center shadow-sm">
                <div className="text-3xl font-extrabold text-primary">
                  {cat.value}
                </div>
                <div className="mt-2 text-xs text-subtitle">
                  {cat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!pointsLoadError && (
        <PointsGuide attendance={attendanceLoadError ? [] : attendance} />
      )}

      {/* Attendance History */}
      <div className="mb-8">
        <h2 className="mb-3 text-lg font-bold text-text">
          This Semester
        </h2>
        <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
          {attendanceLoadError && (
            <EmptyState
              icon={AlertCircle}
              title="Couldn’t load attendance"
              description="Refresh the page to try again."
              compact
            />
          )}
          {!attendanceLoadError && attendance.length === 0 && (
            <EmptyState
              icon={Calendar}
              title="No events attended yet this semester"
              description="Attend CSA events to start earning points."
              compact
            />
          )}
          {!attendanceLoadError && attendance.map((row) => {
            const cat = row.events?.category ?? 'default'
            const catColor = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.default
            return (
              <div key={row.id} className="flex items-center gap-4 border-b border-home-border px-5 py-3 last:border-b-0">
                {/* Point badge */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-extrabold text-primary">
                  {row.counted ? `+${row.events?.point_value}` : '—'}
                </div>

                {/* Event info */}
                <div style={{ flex: 1 }}>
                  <div className="text-sm font-medium text-text">
                    {row.events?.name}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-subtitle">
                    <span>
                      {row.events?.starts_at
                        ? formatEventSchedule(row.events.starts_at, row.events.ends_at)
                        : '—'}
                    </span>
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                      {cat}
                    </span>
                    {!row.counted && (
                      <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] text-red-500">
                        cap reached
                      </span>
                    )}
                  </div>
                </div>

                {/* Check-in method */}
                <div className="text-xs text-subtitle">
                  {CHECKIN_LABELS[row.check_in_method] ?? row.check_in_method}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Semester History */}
      {historyLoadError && (
        <div className="mb-8 overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
          <EmptyState
            icon={AlertCircle}
            title="Couldn’t load past semesters"
            description="Refresh the page to try again."
            compact
          />
        </div>
      )}
      {!historyLoadError && history.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-bold text-text">
            Past Semesters
          </h2>
          <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
            {history.map((sem) => (
              <div key={sem.id} className="flex items-center justify-between border-b border-home-border px-5 py-4 last:border-b-0">
                <div>
                  <div className="text-sm font-medium text-text">
                    {sem.semesters?.name}
                  </div>
                  <div className="mt-1 text-xs text-subtitle">
                    {sem.jt_family_name}
                  </div>
                </div>
                <div className="text-base font-bold text-primary">
                  {sem.total_points} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}