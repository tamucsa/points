'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import IconLabel, { CheckInTypeBadge, ScopeBadge } from '@/app/components/IconLabel'
import EmptyState from '@/app/components/EmptyState'
import { EventMetaChip, EventMetaItem, EventMetaRow } from '@/app/components/EventMeta'
import PageHeader from '@/app/components/PageHeader'
import { formatEventDate, isEventPast } from '@/utils/datetime'
import { Calendar, MapPin, Plus, Star, Users } from 'lucide-react'

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

const actionPrimaryClassName =
  'min-h-11 flex-1 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/20 sm:min-h-0 sm:flex-none sm:px-3 sm:py-2 sm:text-xs'

const actionSecondaryClassName =
  'min-h-11 flex-1 rounded-xl border border-home-border bg-white px-4 py-2.5 text-sm text-subtitle transition hover:border-primary/30 hover:bg-bg hover:text-text sm:min-h-0 sm:flex-none sm:px-3 sm:py-2 sm:text-xs'

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
        <PageHeader
          title="Officer Events"
          subtitle={`${semester?.name ?? 'Current Semester'} · ${events.length} events`}
        />
        <button
          onClick={() => router.push('/officer/events/new')}
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#35679e]"
        >
          <Plus className="size-4" aria-hidden />
          New Event
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {events.length === 0 && (
          <EmptyState
            icon={Calendar}
            title="No events yet"
            description="Create your first event using the button above."
          />
        )}

        {events.map(event => {
          const isPast = isEventPast(event.starts_at)
          const count = attendanceCounts[event.id] ?? 0

          return (
            <div
              key={event.id}
              role="link"
              tabIndex={0}
              aria-label={`View ${event.name}`}
              onClick={() => router.push(`/officer/events/${event.id}`)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  router.push(`/officer/events/${event.id}`)
                }
              }}
              className={`flex cursor-pointer flex-col gap-4 rounded-3xl border border-home-border bg-white p-5 shadow-sm transition hover:border-primary/25 hover:shadow-[0_8px_28px_rgba(71,121,184,0.1)] sm:flex-row sm:items-center ${isPast ? 'opacity-75' : ''}`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">
                {event.point_value}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-text">{event.name}</span>
                  {!isPast && (
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold leading-none text-primary">
                      Upcoming
                    </span>
                  )}
                </div>
                <EventMetaRow className="mt-2">
                  <EventMetaItem>
                    <IconLabel icon={Calendar} label={formatEventDate(event.starts_at)} size="sm" />
                  </EventMetaItem>
                  {event.location && (
                    <EventMetaItem>
                      <IconLabel icon={MapPin} label={event.location} size="sm" />
                    </EventMetaItem>
                  )}
                </EventMetaRow>
                <EventMetaRow className="mt-1.5">
                  <EventMetaChip>{event.category}</EventMetaChip>
                  <EventMetaChip>
                    <ScopeBadge scope={event.scope} />
                  </EventMetaChip>
                  <EventMetaChip>
                    <CheckInTypeBadge checkInType={event.check_in_type} />
                  </EventMetaChip>
                  <EventMetaItem>
                    <IconLabel icon={Users} label={`${count} attended`} size="sm" />
                  </EventMetaItem>
                </EventMetaRow>
              </div>

              <div
                className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto"
                onClick={e => e.stopPropagation()}
                onKeyDown={e => e.stopPropagation()}
              >
                {event.check_in_type === 'self' && event.check_in_code && (
                  <>
                    <button
                      type="button"
                      onClick={() => setQrEvent(event)}
                      className={actionPrimaryClassName}
                    >
                      Show QR
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(`/officer/events/${event.id}/qr`, '_blank')}
                      className={actionSecondaryClassName}
                    >
                      Full Screen
                    </button>
                  </>
                )}
                {(event.check_in_type === 'officer' || event.check_in_type === 'rsvp_required') && (
                  <button
                    type="button"
                    onClick={() => router.push(`/officer/events/${event.id}/checkin`)}
                    className={actionPrimaryClassName}
                  >
                    Check In
                  </button>
                )}
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
            <p className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-subtitle">
              <IconLabel icon={Calendar} label={formatEventDate(qrEvent.starts_at)} size="sm" />
              <IconLabel
                icon={Star}
                label={`${qrEvent.point_value} pt`}
                size="sm"
                iconClassName="text-primary"
              />
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => window.open(`/officer/events/${qrEvent.id}/qr`, '_blank')}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#35679e]"
              >
                Full Screen
              </button>
              <button
                type="button"
                onClick={() => setQrEvent(null)}
                className="rounded-xl border border-home-border bg-white px-4 py-2 text-sm text-subtitle transition hover:border-primary/30 hover:text-text"
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
