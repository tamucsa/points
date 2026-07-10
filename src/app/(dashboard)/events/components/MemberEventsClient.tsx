'use client'
import { useState } from 'react'
import { isJiatingOlympicsCategory, isMixerCategory, isSportsRelatedCategory } from '@/utils/events'

interface Event {
  id: string
  name: string
  category: string
  point_value: number
  scope: string
  check_in_type: string
  event_date: string
  location: string | null
  rsvp_url: string | null
  rsvp_deadline: string | null
}

interface Props {
  events: Event[]
  attendedIds: Set<string>
  semester: { name: string } | null
}

const POINT_COLORS: Record<number, string> = {
  3: '#4f6ef7',
  2: '#f7934f',
  1: '#4fc787',
}

const CHECKIN_BADGE: Record<string, string> = {
  self:          '🔲 QR Check-in',
  officer:       '👤 Officer Check-in',
  rsvp_required: '📋 RSVP Required',
}

function EventCard({ event, attended }: { event: Event, attended: boolean }) {
  const now = new Date()
  const eventDate = new Date(event.event_date)
  const isPast = eventDate < now
  const rsvpOpen = event.rsvp_url && event.rsvp_deadline && new Date(event.rsvp_deadline) > now
  const rsvpClosed = event.rsvp_url && event.rsvp_deadline && new Date(event.rsvp_deadline) <= now
  const pointColor = POINT_COLORS[event.point_value] ?? '#888'

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
            📅 {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {event.location && (
            <span>📍 {event.location}</span>
          )}
          <span className="rounded-md bg-bg px-2 py-0.5 text-[11px] text-subtitle">
            {CHECKIN_BADGE[event.check_in_type]}
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
  const now = new Date()

  const upcoming = events.filter(e => new Date(e.event_date) >= now)
  const past     = events.filter(e => new Date(e.event_date) < now)

  const sections = [
    {
      label: '🏫 CSA-Wide',
      events: upcoming.filter(e => e.scope === 'org'),
    },
    {
      label: '🏠 Your JT Events',
      events: upcoming.filter(e => e.scope === 'jt_specific'),
    },
    {
      label: '🏅 JT Olympics',
      events: upcoming.filter(e => e.scope === 'jt_shared' && isJiatingOlympicsCategory(e.category)),
    },
    {
      label: '🤝 Mixers',
      events: upcoming.filter(e => isMixerCategory(e.category)),
    },
    {
      label: '⚽ Sports & Dance',
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
          <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-subtitle">
            {section.label}
          </h2>
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