'use client'

import { useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import IconLabel from '@/app/components/IconLabel'
import { formatEventSchedule } from '@/utils/datetime'
import { Clock, MapPin, Printer, Star } from 'lucide-react'

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

export default function QRFullScreen({
  event,
  origin,
  autoPrint = false,
}: {
  event: Event
  origin: string
  autoPrint?: boolean
}) {
  const checkInUrl = `${origin}/checkin/${event.check_in_code}`

  useEffect(() => {
    if (!autoPrint) return
    const timer = window.setTimeout(() => window.print(), 300)
    return () => window.clearTimeout(timer)
  }, [autoPrint])

  return (
    <>
      <div className="force-light qr-screen-only flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 py-10">
        <h1 className="max-w-lg text-center text-3xl font-extrabold text-text">{event.name}</h1>
        {event.location && (
          <p className="text-base text-subtitle">
            <IconLabel icon={MapPin} label={event.location} href={event.location_maps_url} />
          </p>
        )}
        <div className="rounded-3xl bg-surface p-7 shadow-theme-md">
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
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-sm transition hover:bg-primary-hover"
        >
          <Printer className="size-4" aria-hidden />
          Print QR Code
        </button>
      </div>

      <div className="qr-print-sheet" aria-hidden>
        <QRCodeSVG value={checkInUrl} size={512} level="H" />
      </div>
    </>
  )
}
