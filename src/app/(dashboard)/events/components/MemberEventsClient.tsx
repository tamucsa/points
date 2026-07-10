'use client'
import { useState } from 'react'
import IconLabel, { CheckInTypeBadge } from '@/app/components/IconLabel'
import { isJiatingOlympicsCategory, isMixerCategory, isSportsRelatedCategory } from '@/utils/events'
import { formatEventSchedule, isEventPast } from '@/utils/datetime'
import { Building2, Clock, Handshake, Home, MapPin, Medal, Trophy } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Event {
  id: string
  name: string
  category: string
  point_value: number
  scope: string
  check_in_type: string
  starts_at: string
  ends_at: string | null
  location: string | null
  rsvp_url: string | null
  rsvp_deadline: string | null
}

interface Props {
  events: Event[]
  attendedIds: Set<string>
  semester: { name: string } | null
}

function SectionHeader({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-subtitle">
      <Icon className="size-3.5 text-primary" aria-hidden />
      {label}
    </h2>
  )
}

function EventCard({ event, attended }: { event: Event, attended: boolean }) {
  const isPast = isEventPast(event.starts_at)
  const rsvpOpen = event.rsvp_url && event.rsvp_deadline && new Date(event.rsvp_deadline) > new Date()
  const rsvpClosed = event.rsvp_url && event.rsvp_deadline && new Date(event.rsvp_deadline) <= new Date()

  return (
    <div className="flex items-center gap-4 rounded-3xl border border-home-border bg-white px-5 py-4 shadow-sm" style={{ opacity: isPast && !attended ? 0.65 : 1 }}>
      {/* Point badge */}
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-extrabold text-primary">
        {event.point_value}
      </div>

      {/* Event info */}
      <div style={{ flex: 1 }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text">
            {event.name}
          </span>
          {attended && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              ✓ Attended
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-subtitle">
          <span>
            <IconLabel icon={Clock} label={formatEventSchedule(event.starts_at, event.ends_at)} size="sm" />
          </span>
          {event.location && (
            <IconLabel icon={MapPin} label={event.location} size="sm" />
          )}
          <span className="rounded-md bg-bg px-2 py-0.5 text-[11px] text-subtitle">
            <CheckInTypeBadge checkInType={event.check_in_type} />
          </span>
        </div>
      </div>

      {/* RSVP button */}
      {rsvpOpen && (
        <a
          href={event.rsvp_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#35679e]"
        >
          Sign Up
        </a>
      )}
      {rsvpClosed && (
        <span className="shrink-0 rounded-xl border border-home-border bg-bg px-4 py-2 text-sm font-medium text-subtitle">
          RSVP Closed
        </span>
      )}
    </div>
  )
}

export default function MemberEventsClient({ events, attendedIds, semester }: Props) {
  const [showPast, setShowPast] = useState(false)
  const upcoming = events.filter(e => !isEventPast(e.starts_at))
  const past     = events.filter(e => isEventPast(e.starts_at))

  const sections: { label: string; icon: LucideIcon; events: Event[] }[] = [
    {
      label: 'CSA-Wide',
      icon: Building2,
      events: upcoming.filter(e => e.scope === 'org'),
    },
    {
      label: 'Your JT Events',
      icon: Home,
      events: upcoming.filter(e => e.scope === 'jt_specific'),
    },
    {
      label: 'JT Olympics',
      icon: Medal,
      events: upcoming.filter(e => e.scope === 'jt_shared' && isJiatingOlympicsCategory(e.category)),
    },
    {
      label: 'Mixers',
      icon: Handshake,
      events: upcoming.filter(e => isMixerCategory(e.category)),
    },
    {
      label: 'Sports & Dance',
      icon: Trophy,
      events: upcoming.filter(e => isSportsRelatedCategory(e.category)),
    },
  ].filter(s => s.events.length > 0)

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-text">Events</h1>
        <div className="mt-1 text-sm text-subtitle">
          {semester?.name ?? 'Current Semester'}
        </div>
      </div>

      {/* Upcoming sections */}
      {sections.length === 0 && (
        <div className="rounded-4xl border border-home-border bg-white px-10 py-12 text-center text-sm text-subtitle shadow-sm">
          No upcoming events this semester.
        </div>
      )}

      {sections.map(section => (
        <div key={section.label} className="mb-8">
          <SectionHeader icon={section.icon} label={section.label} />
          <div className="flex flex-col gap-3">
            {section.events.map(event => (
              <EventCard
                key={event.id}
                event={event}
                attended={attendedIds.has(event.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Past events toggle */}
      {past.length > 0 && (
        <div>
          <button
            onClick={() => setShowPast(p => !p)}
            className="mb-4 rounded-xl border border-home-border bg-white px-4 py-2 text-sm text-subtitle shadow-sm transition hover:border-primary/30 hover:text-primary"
          >
            {showPast ? '▲ Hide' : '▼ Show'} Past Events ({past.length})
          </button>

          {showPast && (
            <div className="flex flex-col gap-3">
              {past.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  attended={attendedIds.has(event.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}