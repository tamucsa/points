'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { selfCheckIn } from '@/app/actions/attendance'
import IconLabel from '@/app/components/IconLabel'
import { formatEventSchedule } from '@/utils/datetime'
import { CircleCheck, Clock, MapPin, PartyPopper, Star } from 'lucide-react'

interface Event {
  id: string
  name: string
  category: string
  point_value: number
  starts_at: string
  ends_at: string | null
  location: string | null
  location_maps_url?: string | null
  check_in_type: string
  semester_id: string
}

interface Member {
  id: string
  status: string
  full_name: string
}

interface Props {
  event: Event
  code: string
  userEmail: string | null
  member: Member | null
  alreadyCheckedIn: boolean
}

export default function CheckinClient({ event, code, userEmail, member, alreadyCheckedIn }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [counted, setCounted] = useState(true)

  const signIn = () => {
    const redirectTo = `${window.location.origin}/checkin/${code}`
    router.push(`/?next=${encodeURIComponent(redirectTo)}`)
  }

  const checkIn = async () => {
    if (!member) return
    setError(null)
    setSubmitting(true)

    const result = await selfCheckIn(event.id, event.semester_id)

    if (!result.success) {
      setError(result.error ?? 'Check-in failed.')
      setSubmitting(false)
      return
    }

    setCounted(result.counted)
    setSuccess(true)
    setSubmitting(false)
  }

  const eventSchedule = formatEventSchedule(event.starts_at, event.ends_at)
  const pointLabel = `${event.point_value} point${event.point_value !== 1 ? 's' : ''}`

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg px-6 py-10 text-text">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(71,121,184,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(240,176,195,0.22),transparent_38%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-lg items-center justify-center">
        <div className="w-full overflow-hidden rounded-4xl border border-home-border bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="bg-[linear-gradient(135deg,rgba(71,121,184,0.08),rgba(255,255,255,0.9)_52%,rgba(240,176,195,0.16))] p-8 sm:p-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary backdrop-blur">
              Event Check-in
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
              {event.name}
            </h1>
            <div className="mt-3 flex flex-col gap-1.5 text-sm text-subtitle">
              <IconLabel icon={Clock} label={eventSchedule} size="sm" />
              {event.location && (
                <IconLabel
                  icon={MapPin}
                  label={event.location}
                  size="sm"
                  href={event.location_maps_url}
                />
              )}
              <IconLabel icon={Star} label={pointLabel} size="sm" iconClassName="text-primary" />
            </div>

            <div className="mt-8">
              {!userEmail && (
                <div className="space-y-4">
                  <p className="text-sm leading-6 text-subtitle">
                    Sign in with your TAMU Google account to check in.
                  </p>
                  <button
                    onClick={signIn}
                    className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(71,121,184,0.24)] transition hover:bg-[#35679e]"
                  >
                    Sign in to Check In
                  </button>
                </div>
              )}

              {userEmail && !member && (
                <div className="rounded-2xl border border-home-border bg-bg p-4">
                  <p className="text-sm leading-6 text-subtitle">
                    No member profile found for {userEmail}. Please complete registration first.
                  </p>
                  <button
                    onClick={() => router.push('/register')}
                    className="mt-4 w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white"
                  >
                    Complete Registration
                  </button>
                </div>
              )}

              {userEmail && member && member.status === 'pending_member' && (
                <div className="rounded-2xl border border-accent/35 bg-[linear-gradient(180deg,rgba(240,176,195,0.18),rgba(255,255,255,0.9))] p-4">
                  <p className="text-sm leading-6 text-subtitle">
                    Your membership is awaiting approval. You&apos;ll be able to check in once an admin activates you.
                  </p>
                  <button
                    onClick={() => router.push('/pending')}
                    className="mt-4 w-full rounded-xl border border-home-border bg-white px-4 py-2 text-sm font-medium text-subtitle"
                  >
                    View Status
                  </button>
                </div>
              )}

              {userEmail && member && member.status === 'active' && alreadyCheckedIn && !success && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
                  <CircleCheck className="mx-auto size-10 text-primary" aria-hidden />
                  <p className="mt-2 text-sm font-medium text-primary">
                    You&apos;re already checked in!
                  </p>
                </div>
              )}

              {userEmail && member && member.status === 'active' && !alreadyCheckedIn && !success && (
                <div className="space-y-4">
                  <p className="text-sm text-subtitle">
                    Checking in as <span className="font-medium text-text">{member.full_name}</span>
                  </p>
                  {error && (
                    <div className="rounded-2xl border border-[#f5b0b0] bg-[#fff4f4] p-3">
                      <p className="text-sm text-[#c94b4b]">{error}</p>
                    </div>
                  )}
                  <button
                    onClick={checkIn}
                    disabled={submitting}
                    className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-white shadow-[0_12px_28px_rgba(71,121,184,0.24)] transition hover:bg-[#35679e] disabled:cursor-not-allowed disabled:bg-[#9cb8d8]"
                  >
                    {submitting ? 'Checking in…' : 'Check In'}
                  </button>
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
                  <PartyPopper className="mx-auto size-10 text-primary" aria-hidden />
                  <p className="mt-2 text-base font-semibold text-text">You&apos;re checked in!</p>
                  {counted ? (
                    <p className="mt-1 text-sm text-subtitle">
                      +{event.point_value} point{event.point_value !== 1 ? 's' : ''} added
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-subtitle">
                      Attendance recorded, but this check-in doesn&apos;t add points under current
                      caps.
                    </p>
                  )}
                  <button
                    onClick={() => router.push('/events')}
                    className="mt-4 w-full rounded-xl border border-home-border bg-white px-4 py-2 text-sm font-medium text-subtitle transition hover:border-primary/30 hover:text-primary"
                  >
                    View Events
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
