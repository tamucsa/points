'use client'
import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useRouter } from 'next/navigation'

interface Event {
  id: string
  name: string
  category: string
  point_value: number
  scope: string
  check_in_type: string
  event_date: string
  location: string | null
  check_in_code: string | null
  rsvp_url: string | null
  rsvp_deadline: string | null
}

interface Props {
  events: Event[]
  attendanceCounts: Record<string, number>
  semester: { id: string, name: string } | null
}

const POINT_COLORS: Record<number, string> = {
  3: '#4f6ef7',
  2: '#f7934f',
  1: '#4fc787',
}

export default function OfficerDashboardClient({ events, attendanceCounts, semester }: Props) {
  const router = useRouter()
  const [qrEvent, setQrEvent] = useState<Event | null>(null)

  const checkInUrl = (code: string) =>
    `${window.location.origin}/checkin/${code}`

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Events</h1>
          <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{semester?.name}</div>
        </div>
        <button
          onClick={() => router.push('/officer/events/new')}
          style={{
            padding: '9px 18px', background: '#4f6ef7', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + New Event
        </button>
      </div>

      {/* Event list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {events.length === 0 && (
          <div style={{
            padding: 40, textAlign: 'center', color: '#444',
            background: '#161a27', borderRadius: 14, border: '1px solid #1e2337',
          }}>
            No events yet. Create your first event above.
          </div>
        )}

        {events.map(event => {
          const pointColor = POINT_COLORS[event.point_value] ?? '#888'
          const count = attendanceCounts[event.id] ?? 0

          return (
            <div key={event.id} style={{
              padding: '16px 20px',
              background: '#161a27',
              borderRadius: 12,
              border: '1px solid #1e2337',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
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
                <div style={{ fontSize: 14, fontWeight: 600, color: '#ddd' }}>
                  {event.name}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#555' }}>
                    📅 {new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  {event.location && (
                    <span style={{ fontSize: 12, color: '#555' }}>📍 {event.location}</span>
                  )}
                  <span style={{
                    fontSize: 11, padding: '1px 6px', borderRadius: 4,
                    background: '#ffffff10', color: '#666',
                  }}>
                    {event.category}
                  </span>
                  <span style={{ fontSize: 12, color: '#555' }}>
                    👥 {count} attended
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {event.check_in_type === 'self' && event.check_in_code && (
                  <>
                    <button
                      onClick={() => setQrEvent(event)}
                      style={{
                        padding: '6px 12px', background: '#4f6ef720',
                        border: '1px solid #4f6ef740', color: '#4f6ef7',
                        borderRadius: 7, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Show QR
                    </button>
                    <button
                      onClick={() => window.open(`/officer/events/${event.id}/qr`, '_blank')}
                      style={{
                        padding: '6px 12px', background: 'transparent',
                        border: '1px solid #2a2f45', color: '#666',
                        borderRadius: 7, fontSize: 12, fontWeight: 500,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Full Screen
                    </button>
                  </>
                )}
                {event.check_in_type === 'officer' && (
                  <button
                    onClick={() => router.push(`/officer/events/${event.id}/checkin`)}
                    style={{
                      padding: '6px 12px', background: '#4fc78720',
                      border: '1px solid #4fc78740', color: '#4fc787',
                      borderRadius: 7, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Check In
                  </button>
                )}
                <button
                  onClick={() => router.push(`/officer/events/${event.id}`)}
                  style={{
                    padding: '6px 12px', background: 'transparent',
                    border: '1px solid #2a2f45', color: '#666',
                    borderRadius: 7, fontSize: 12,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  View
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* QR Modal */}
      {qrEvent && (
        <div
          onClick={() => setQrEvent(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: '#000000cc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#161a27', borderRadius: 20,
              border: '1px solid #1e2337',
              padding: 40, textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
              {qrEvent.name}
            </div>
            <div style={{
              padding: 20, background: '#fff', borderRadius: 12,
            }}>
              <QRCodeSVG
                value={checkInUrl(qrEvent.check_in_code!)}
                size={220}
                level="H"
              />
            </div>
            <div style={{ fontSize: 13, color: '#555' }}>
              📅 {new Date(qrEvent.event_date).toLocaleDateString()} · ⭐ {qrEvent.point_value} point{qrEvent.point_value !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => window.open(`/officer/events/${qrEvent.id}/qr`, '_blank')}
                style={{
                  padding: '8px 16px', background: '#4f6ef7', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Open Full Screen
              </button>
              <button
                onClick={() => setQrEvent(null)}
                style={{
                  padding: '8px 16px', background: 'transparent',
                  border: '1px solid #2a2f45', color: '#666',
                  borderRadius: 8, fontSize: 13,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
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