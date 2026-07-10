'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import IconLabel, { CheckInTypeBadge, ScopeBadge } from '@/app/components/IconLabel'
import { POINT_COLORS } from '@/utils/constants'
import { formatEventDate, isEventPast } from '@/utils/datetime'
import { Users } from 'lucide-react'

interface Event {
  id: string
  name: string
  category: string
  point_value: number
  scope: string
  check_in_type: string
  starts_at: string
  location: string | null
  check_in_code: string | null
}

interface Props {
  events: Event[]
  attendanceCounts: Record<string, number>
  semester: { id: string; name: string } | null
}

export default function OfficerEventsClient({ events, attendanceCounts, semester }: Props) {
  const router = useRouter()
  const [qrEvent, setQrEvent] = useState<Event | null>(null)

  const checkInUrl = (code: string) =>
    typeof window !== 'undefined'
      ? `${window.location.origin}/checkin/${code}`
      : `/checkin/${code}`

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text">Officer Events</h1>
          <p className="mt-1 text-sm text-subtitle">
            {semester?.name} · {events.length} events
          </p>
        </div>
        <button
          onClick={() => router.push('/officer/events/new')}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#35679e]"
        >
          + New Event
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {events.length === 0 && (
          <div className="rounded-4xl border border-home-border bg-white px-10 py-12 text-center text-sm text-subtitle shadow-sm">
            No events yet. Create your first event above.
          </div>
        )}

        {events.map(event => {
          const isPast = isEventPast(event.starts_at)
          const count = attendanceCounts[event.id] ?? 0

          return (
            <div
              key={event.id}
              className={`flex flex-col gap-4 rounded-3xl border border-home-border bg-white p-5 shadow-sm sm:flex-row sm:items-center ${isPast ? 'opacity-75' : ''}`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">
                {event.point_value}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text">{event.name}</span>
                  {!isPast && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      Upcoming
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-subtitle">
                  <span>
                    📅 {formatEventDate(event.starts_at)}
                  </span>
                  {event.location && <span>📍 {event.location}</span>}
                  <span className="rounded-md bg-bg px-2 py-0.5">{event.category}</span>
                  <span className="rounded-md bg-bg px-2 py-0.5">
                    <ScopeBadge scope={event.scope} />
                  </span>
                  <span className="rounded-md bg-bg px-2 py-0.5">
                    <CheckInTypeBadge checkInType={event.check_in_type} />
                  </span>
                  <IconLabel icon={Users} label={`${count} attended`} size="sm" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                {event.check_in_type === 'self' && event.check_in_code && (
                  <>
                    <button
                      onClick={() => setQrEvent(event)}
                      className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
                    >
                      Show QR
                    </button>
                    <button
                      onClick={() => window.open(`/officer/events/${event.id}/qr`, '_blank')}
                      className="rounded-xl border border-home-border px-3 py-2 text-xs text-subtitle"
                    >
                      Full Screen
                    </button>
                  </>
                )}
                {(event.check_in_type === 'officer' || event.check_in_type === 'rsvp_required') && (
                  <button
                    onClick={() => router.push(`/officer/events/${event.id}/checkin`)}
                    className="rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
                  >
                    Check In
                  </button>
                )}
                <button
                  onClick={() => router.push(`/officer/events/${event.id}`)}
                  className="rounded-xl border border-home-border px-3 py-2 text-xs text-subtitle"
                >
                  View
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {qrEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setQrEvent(null)}
        >
          <div
            className="w-full max-w-sm rounded-4xl border border-home-border bg-white p-8 text-center shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-text">{qrEvent.name}</h2>
            <div className="mx-auto mt-5 inline-block rounded-2xl bg-white p-5 shadow-sm">
              <QRCodeSVG
                value={checkInUrl(qrEvent.check_in_code!)}
                size={220}
                level="H"
              />
            </div>
            <p className="mt-4 text-sm text-subtitle">
              📅 {formatEventDate(qrEvent.starts_at)} · ⭐ {qrEvent.point_value} pt
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                onClick={() => window.open(`/officer/events/${qrEvent.id}/qr`, '_blank')}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Full Screen
              </button>
              <button
                onClick={() => setQrEvent(null)}
                className="rounded-xl border border-home-border px-4 py-2 text-sm text-subtitle"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
