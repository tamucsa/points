'use client'

import { QRCodeSVG } from 'qrcode.react'
import IconLabel from '@/app/components/IconLabel'
import { formatEventSchedule } from '@/utils/datetime'
import { Clock, MapPin, Star } from 'lucide-react'

interface Event {
  id: string
  name: string
  starts_at: string
  ends_at: string | null
  point_value: number
  check_in_code: string
  location: string | null
  location_maps_url?: string | null
}

export default function QRFullScreen({ event, origin }: { event: Event; origin: string }) {
  const checkInUrl = `${origin}/checkin/${event.check_in_code}`

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 py-10">
      <h1 className="max-w-lg text-center text-3xl font-extrabold text-text">{event.name}</h1>
      {event.location && (
        <p className="text-base text-subtitle">
          <IconLabel icon={MapPin} label={event.location} href={event.location_maps_url} />
        </p>
      )}
      <div className="rounded-3xl bg-white p-7 shadow-[0_20px_60px_rgba(71,121,184,0.15)]">
        <QRCodeSVG value={checkInUrl} size={300} level="H" />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-4 text-lg text-subtitle">
        <IconLabel icon={Clock} label={formatEventSchedule(event.starts_at, event.ends_at)} />
        <IconLabel
          icon={Star}
          label={`+${event.point_value} point${event.point_value !== 1 ? 's' : ''}`}
          iconClassName="text-primary"
          labelClassName="font-bold text-primary"
        />
      </div>
      <p className="text-sm text-subtitle">Scan to check in</p>
    </div>
  )
}
