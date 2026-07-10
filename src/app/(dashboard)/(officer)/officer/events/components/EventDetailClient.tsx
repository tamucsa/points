'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { publishJiatingStandings } from '@/app/actions/jt-standings'
import { updateEventRsvp } from '@/app/actions/events'
import MemberAvatar from '@/app/components/MemberAvatar'
import IconLabel, { CheckInMethodBadge } from '@/app/components/IconLabel'
import { isGeneralMeetingCategory } from '@/utils/events'
import { formatEventSchedule } from '@/utils/datetime'
import { Clock, MapPin } from 'lucide-react'
import { inputClassName, labelClassName } from '@/utils/constants'

interface Event {
  id: string
  name: string
  category: string
  point_value: number
  check_in_type: string
  starts_at: string
  ends_at: string | null
  location: string | null
  description: string | null
  check_in_code: string | null
  rsvp_url: string | null
  rsvp_deadline: string | null
}

interface AttendanceRow {
  id: string
  check_in_method: string
  verified: boolean
  counted: boolean
  recorded_at: string
  members: {
    full_name: string
    profile_image_url: string | null
  } | null
}

interface PublishedSnapshot {
  id: string
  snapshot_at: string
  label: string | null
}

interface Props {
  event: Event
  attendance: AttendanceRow[]
  publishedSnapshot: PublishedSnapshot | null
}

export default function EventDetailClient({ event, attendance, publishedSnapshot }: Props) {
  const router = useRouter()
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)
  const [published, setPublished] = useState(publishedSnapshot)
  const [rsvpUrl, setRsvpUrl] = useState(event.rsvp_url ?? '')
  const [rsvpDeadline, setRsvpDeadline] = useState(
    event.rsvp_deadline ? event.rsvp_deadline.slice(0, 16) : '',
  )
  const [rsvpSaving, setRsvpSaving] = useState(false)
  const [rsvpError, setRsvpError] = useState<string | null>(null)
  const [rsvpSaved, setRsvpSaved] = useState(false)
  const isGm = isGeneralMeetingCategory(event.category)
  const isRsvpEvent = event.check_in_type === 'rsvp_required'

  const handleSaveRsvp = async () => {
    setRsvpSaving(true)
    setRsvpError(null)
    setRsvpSaved(false)

    const result = await updateEventRsvp(
      event.id,
      rsvpUrl.trim() || null,
      rsvpDeadline || null,
    )

    setRsvpSaving(false)
    if (!result.success) {
      setRsvpError(result.error ?? 'Failed to save RSVP details.')
      return
    }
    setRsvpSaved(true)
    router.refresh()
  }

  const handlePublishStandings = async () => {
    if (!window.confirm('Publish Jiating standings from current point totals? Members will see this snapshot on the leaderboard until the next General Meeting.')) {
      return
    }

    setPublishing(true)
    setPublishError(null)

    const result = await publishJiatingStandings(event.id)
    setPublishing(false)

    if (!result.success) {
      setPublishError(result.error ?? 'Failed to publish standings.')
      return
    }

    setPublished({
      id: result.snapshotId,
      snapshot_at: new Date().toISOString(),
      label: event.name,
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <button
        onClick={() => router.back()}
        className="mb-5 text-sm text-subtitle transition hover:text-primary"
      >
        ← Back
      </button>

      <div className="mb-6 rounded-4xl border border-home-border bg-white p-6 shadow-sm">
        <div className="flex gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl font-extrabold text-primary">
            {event.point_value}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-text">{event.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-subtitle">
              <IconLabel icon={Clock} label={formatEventSchedule(event.starts_at, event.ends_at)} size="sm" />
              {event.location && <IconLabel icon={MapPin} label={event.location} size="sm" />}
              <span className="rounded-md bg-bg px-2 py-0.5 text-xs">{event.category}</span>
            </div>
            {event.description && (
              <p className="mt-3 text-sm leading-6 text-subtitle">{event.description}</p>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {(event.check_in_type === 'officer' || event.check_in_type === 'rsvp_required') && (
            <button
              onClick={() => router.push(`/officer/events/${event.id}/checkin`)}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              Check In Members
            </button>
          )}
          {event.check_in_type === 'self' && event.check_in_code && (
            <button
              onClick={() => window.open(`/officer/events/${event.id}/qr`, '_blank')}
              className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"
            >
              Open QR Full Screen
            </button>
          )}
          {event.rsvp_url && (
            <a
              href={event.rsvp_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-home-border px-4 py-2 text-sm font-semibold text-subtitle"
            >
              View RSVP Form
            </a>
          )}
          {isGm && !published && (
            <button
              type="button"
              onClick={() => void handlePublishStandings()}
              disabled={publishing}
              className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {publishing ? 'Publishing…' : 'Publish Jiating standings'}
            </button>
          )}
          {isGm && published && (
            <span className="inline-flex items-center rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
              Standings published
            </span>
          )}
        </div>
        {publishError && (
          <p className="mt-3 text-sm text-red-600">{publishError}</p>
        )}
        {isRsvpEvent && (
          <div className="mt-5 space-y-3 rounded-2xl border border-home-border bg-bg p-4">
            <div className="text-sm font-semibold text-text">RSVP details</div>
            <div>
              <label className={labelClassName}>RSVP Link</label>
              <input
                className={inputClassName}
                placeholder="https://forms.gle/..."
                value={rsvpUrl}
                onChange={e => {
                  setRsvpUrl(e.target.value)
                  setRsvpSaved(false)
                }}
              />
            </div>
            <div>
              <label className={labelClassName}>RSVP Deadline</label>
              <input
                type="datetime-local"
                className={inputClassName}
                value={rsvpDeadline}
                onChange={e => {
                  setRsvpDeadline(e.target.value)
                  setRsvpSaved(false)
                }}
              />
            </div>
            {rsvpError && <p className="text-sm text-red-600">{rsvpError}</p>}
            {rsvpSaved && <p className="text-sm text-green-700">RSVP details saved.</p>}
            <button
              type="button"
              onClick={() => void handleSaveRsvp()}
              disabled={rsvpSaving}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {rsvpSaving ? 'Saving…' : 'Save RSVP details'}
            </button>
          </div>
        )}
        {isGm && published && (
          <p className="mt-3 text-xs text-subtitle">
            Published {new Date(published.snapshot_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            {' · '}
            <button
              type="button"
              onClick={() => router.push('/leaderboard/standings')}
              className="font-medium text-primary hover:underline"
            >
              View on leaderboard
            </button>
          </p>
        )}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Attendance</h2>
        <span className="text-sm text-subtitle">{attendance.length} checked in</span>
      </div>

      <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
        {attendance.length === 0 && (
          <div className="px-8 py-10 text-center text-sm text-subtitle">No check-ins yet.</div>
        )}
        {attendance.map(row => {
          const displayName = row.members?.full_name ?? 'Unknown member'
          return (
          <div key={row.id} className="flex items-center gap-4 border-b border-home-border px-5 py-3 last:border-b-0">
            <MemberAvatar
              name={displayName}
              profileImageUrl={row.members?.profile_image_url ?? null}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text">
                {displayName}
              </div>
              <div className="text-xs text-subtitle">
                {new Date(row.recorded_at).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit',
                })}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1">
              <span className="rounded-md bg-bg px-2 py-0.5 text-[11px] text-subtitle">
                <CheckInMethodBadge checkInMethod={row.check_in_method} />
              </span>
              {!row.verified && (
                <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] text-orange-600">Unverified</span>
              )}
              {!row.counted && (
                <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] text-red-500">Cap reached</span>
              )}
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
