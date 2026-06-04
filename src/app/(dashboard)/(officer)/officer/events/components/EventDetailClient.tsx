'use client'
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
    id: string
    full_name: string
    preferred_name: string | null
    profile_image_url: string | null
  }
}

interface Props {
  event: Event
  attendance: AttendanceRow[]
}

const POINT_COLORS: Record<number, string> = {
  3: '#4f6ef7',
  2: '#f7934f',
  1: '#4fc787',
}

const CHECKIN_LABELS: Record<string, string> = {
  officer: '👤 Officer',
  qr_scan: '🔲 QR Scan',
  self:    '🔲 Self',
}

export default function EventDetailClient({ event, attendance }: Props) {
  const router = useRouter()
  const pointColor = POINT_COLORS[event.point_value] ?? '#888'

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: '0 auto' }}>

      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          background: 'none', border: 'none', color: '#555',
          cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 13, padding: 0, marginBottom: 20,
        }}
      >
        ← Back
      </button>

      {/* Event header */}
      <div style={{
        padding: 24, background: '#161a27',
        borderRadius: 14, border: '1px solid #1e2337',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
            background: pointColor + '20',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800, color: pointColor,
          }}>
            {event.point_value}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              {event.name}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: '#666' }}>
              <span>📅 {new Date(event.event_date).toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
              })}</span>
              {event.location && <span>📍 {event.location}</span>}
              <span style={{
                padding: '1px 8px', borderRadius: 4,
                background: '#ffffff10', color: '#666',
              }}>
                {event.category}
              </span>
            </div>
            {event.description && (
              <p style={{ fontSize: 13, color: '#555', marginTop: 10 }}>
                {event.description}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          {event.check_in_type === 'officer' && (
            <button
              onClick={() => router.push(`/officer/events/${event.id}/checkin`)}
              style={{
                padding: '8px 16px', background: '#4fc78720',
                border: '1px solid #4fc78740', color: '#4fc787',
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Check In Members
            </button>
          )}
          {event.check_in_type === 'self' && event.check_in_code && (
            <button
              onClick={() => window.open(`/officer/events/${event.id}/qr`, '_blank')}
              style={{
                padding: '8px 16px', background: '#4f6ef720',
                border: '1px solid #4f6ef740', color: '#4f6ef7',
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Open QR Full Screen
            </button>
          )}
          {event.rsvp_url && (
            <a
              href={event.rsvp_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '8px 16px', background: '#f7934f20',
                border: '1px solid #f7934f40', color: '#f7934f',
                borderRadius: 8, fontSize: 13, fontWeight: 600,
                textDecoration: 'none', display: 'inline-block',
              }}
            >
              View RSVP Form
            </a>
          )}
        </div>
      </div>

      {/* Attendance list */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 12,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
            Attendance
          </h2>
          <span style={{ fontSize: 13, color: '#555' }}>
            {attendance.length} checked in
          </span>
        </div>

        <div style={{
          background: '#161a27', borderRadius: 14,
          border: '1px solid #1e2337', overflow: 'hidden',
        }}>
          {attendance.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#444', fontSize: 14 }}>
              No check-ins yet.
            </div>
          )}
          {attendance.map((row, i) => (
            <div key={row.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 20px',
              borderBottom: i < attendance.length - 1 ? '1px solid #0f1117' : 'none',
            }}>
              {row.members.profile_image_url ? (
                <img
                  src={row.members.profile_image_url}
                  style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: '#4f6ef720', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#4f6ef7',
                }}>
                  {(row.members.preferred_name || row.members.full_name)[0]}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>
                  {row.members.preferred_name || row.members.full_name}
                </div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                  {new Date(row.recorded_at).toLocaleTimeString('en-US', {
                    hour: 'numeric', minute: '2-digit'
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{
                  fontSize: 11, padding: '2px 7px', borderRadius: 4,
                  background: '#ffffff08', color: '#555',
                }}>
                  {CHECKIN_LABELS[row.check_in_method] ?? row.check_in_method}
                </span>
                {!row.verified && (
                  <span style={{
                    fontSize: 11, padding: '2px 7px', borderRadius: 4,
                    background: '#f7934f15', color: '#f7934f',
                  }}>
                    Unverified
                  </span>
                )}
                {!row.counted && (
                  <span style={{
                    fontSize: 11, padding: '2px 7px', borderRadius: 4,
                    background: '#e74c3c15', color: '#e74c3c',
                  }}>
                    Cap reached
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}