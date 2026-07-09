'use client'

import { useRouter } from 'next/navigation'
import MemberAvatar from '@/app/components/MemberAvatar'
import { CHECKIN_METHOD_LABELS } from '@/utils/constants'

interface Event {
  id: string
  name: string
  category: string
  point_value: number
  check_in_type: string
  event_date: string
  location: string | null
  description: string | null
  check_in_code: string | null
  rsvp_url: string | null
}

interface AttendanceRow {
  id: string
  check_in_method: string
  verified: boolean
  counted: boolean
  recorded_at: string
  members: {
    full_name: string
    preferred_name: string | null
    profile_image_url: string | null
  }
}

interface Props {
  event: Event
  attendance: AttendanceRow[]
}

export default function EventDetailClient({ event, attendance }: Props) {
  const router = useRouter()

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
              <span>
                📅 {new Date(event.event_date).toLocaleDateString('en-US', {
                  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                })}
              </span>
              {event.location && <span>📍 {event.location}</span>}
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
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-text">Attendance</h2>
        <span className="text-sm text-subtitle">{attendance.length} checked in</span>
      </div>

      <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
        {attendance.length === 0 && (
          <div className="px-8 py-10 text-center text-sm text-subtitle">No check-ins yet.</div>
        )}
        {attendance.map(row => (
          <div key={row.id} className="flex items-center gap-4 border-b border-home-border px-5 py-3 last:border-b-0">
            <MemberAvatar
              name={row.members.preferred_name || row.members.full_name}
              profileImageUrl={row.members.profile_image_url}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text">
                {row.members.preferred_name || row.members.full_name}
              </div>
              <div className="text-xs text-subtitle">
                {new Date(row.recorded_at).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit',
                })}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1">
              <span className="rounded-md bg-bg px-2 py-0.5 text-[11px] text-subtitle">
                {CHECKIN_METHOD_LABELS[row.check_in_method] ?? row.check_in_method}
              </span>
              {!row.verified && (
                <span className="rounded-md bg-orange-50 px-2 py-0.5 text-[11px] text-orange-600">Unverified</span>
              )}
              {!row.counted && (
                <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] text-red-500">Cap reached</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
