'use client'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useState } from 'react'

interface Event {
  id: string
  name: string
  event_date: string
  point_value: number
  check_in_code: string
  location: string | null
}

const POINT_COLORS: Record<number, string> = {
  3: '#4f6ef7',
  2: '#f7934f',
  1: '#4fc787',
}

export default function QRFullScreen({ event }: { event: Event }) {
  const [origin, setOrigin] = useState('')

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const checkInUrl = `${origin}/checkin/${event.check_in_code}`
  const pointColor = POINT_COLORS[event.point_value] ?? '#4f6ef7'

  return (
    <div style={{
      minHeight: '100vh', background: '#0f1117',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 24,
      padding: 40,
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
        {event.name}
      </div>

      {event.location && (
        <div style={{ fontSize: 16, color: '#555' }}>📍 {event.location}</div>
      )}

      <div style={{
        padding: 28, background: '#fff', borderRadius: 20,
        boxShadow: `0 0 80px ${pointColor}40`,
      }}>
        {origin && (
          <QRCodeSVG
            value={checkInUrl}
            size={300}
            level="H"
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'center', fontSize: 18, color: '#888' }}>
        <span>
          📅 {new Date(event.event_date).toLocaleDateString('en-US', {
            month: 'long', day: 'numeric', year: 'numeric'
          })}
        </span>
        <span style={{ color: pointColor, fontWeight: 700 }}>
          +{event.point_value} point{event.point_value !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ fontSize: 14, color: '#444', marginTop: 8 }}>
        Scan to check in
      </div>
    </div>
  )
}