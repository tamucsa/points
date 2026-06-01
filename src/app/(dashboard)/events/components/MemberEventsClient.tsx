'use client'
import { useState } from 'react'

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
    <div style={{
      padding: '16px 20px',
      background: '#161a27',
      borderRadius: 12,
      border: `1px solid ${attended ? pointColor + '40' : '#1e2337'}`,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      opacity: isPast && !attended ? 0.6 : 1,
    }}>
      {/* Point badge */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: pointColor + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 800, color: pointColor,
      }}>
        {event.point_value}
      </div>

      {/* Event info */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#ddd' }}>
            {event.name}
          </span>
          {attended && (
            <span style={{
              fontSize: 11, padding: '1px 7px', borderRadius: 20,
              background: pointColor + '20', color: pointColor, fontWeight: 600,
            }}>
              ✓ Attended
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 5 }}>
          <span style={{ fontSize: 12, color: '#555' }}>
            📅 {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {event.location && (
            <span style={{ fontSize: 12, color: '#555' }}>📍 {event.location}</span>
          )}
          <span style={{
            fontSize: 11, padding: '1px 7px', borderRadius: 4,
            background: '#ffffff10', color: '#666',
          }}>
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
          style={{
            padding: '7px 16px', borderRadius: 8, flexShrink: 0,
            background: '#4f6ef7', color: '#fff',
            fontSize: 13, fontWeight: 600,
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}
        >
          Sign Up
        </a>
      )}
      {rsvpClosed && (
        <span style={{
          padding: '7px 16px', borderRadius: 8, flexShrink: 0,
          background: '#ffffff08', color: '#444',
          fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
          border: '1px solid #2a2f45',
        }}>
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
      events: upcoming.filter(e => e.scope === 'jt_shared' && e.category === 'JT_Olympics'),
    },
    {
      label: '⚽ Intramural / Sports',
      events: upcoming.filter(e => e.category === 'Sports' || e.category === 'Sports Spectator'),
    },
  ].filter(s => s.events.length > 0)

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Events</h1>
        <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
          {semester?.name ?? 'Current Semester'}
        </div>
      </div>

      {/* Upcoming sections */}
      {sections.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center', color: '#444',
          background: '#161a27', borderRadius: 14, border: '1px solid #1e2337',
        }}>
          No upcoming events this semester.
        </div>
      )}

      {sections.map(section => (
        <div key={section.label} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#888', marginBottom: 10,
            textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {section.label}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
            style={{
              background: 'none', border: '1px solid #2a2f45',
              color: '#555', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, padding: '8px 16px', borderRadius: 8,
              marginBottom: 16,
            }}
          >
            {showPast ? '▲ Hide' : '▼ Show'} Past Events ({past.length})
          </button>

          {showPast && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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