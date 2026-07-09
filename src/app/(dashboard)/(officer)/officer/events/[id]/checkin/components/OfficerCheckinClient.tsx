'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { officerCheckIn } from '@/app/actions/attendance'
import MemberAvatar from '@/app/components/MemberAvatar'

interface Event {
  id: string
  name: string
  category: string
  point_value: number
  event_date: string
  semester_id: string
  check_in_type: string
}

interface Member {
  id: string
  full_name: string
  email: string
  profile_image_url: string | null
  jt_family: string | null
  jt_color: string | null
}

interface Props {
  event: Event
  members: Member[]
  checkedInIds: Set<string>
}

export default function OfficerCheckinClient({ event, members, checkedInIds }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [checkedIn, setCheckedIn] = useState(checkedInIds)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
    )
  }, [members, search])

  const checkInMember = async (memberId: string) => {
    if (checkedIn.has(memberId)) return
    setError(null)
    setSaving(memberId)

    const result = await officerCheckIn(event.id, event.semester_id, memberId)

    if (!result.success) {
      setError(result.error ?? 'Check-in failed.')
      setSaving(null)
      return
    }

    setCheckedIn(prev => new Set([...prev, memberId]))
    setSaving(null)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <button
        onClick={() => router.push(`/officer/events/${event.id}`)}
        className="mb-5 text-sm text-subtitle transition hover:text-primary"
      >
        ← Back to Event
      </button>

      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-text">Check In Members</h1>
        <p className="mt-1 text-sm text-subtitle">{event.name} · {checkedIn.size} checked in</p>
      </div>

      <input
        placeholder="Search by name or email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4 w-full rounded-xl border border-home-border bg-white px-4 py-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />

      {error && (
        <div className="mb-4 rounded-2xl border border-[#f5b0b0] bg-[#fff4f4] p-3">
          <p className="text-sm text-[#c94b4b]">{error}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
        {filtered.length === 0 && (
          <div className="px-8 py-10 text-center text-sm text-subtitle">No members found.</div>
        )}
        {filtered.map(m => {
          const isCheckedIn = checkedIn.has(m.id)
          const displayName = m.full_name
          return (
            <div
              key={m.id}
              className="flex items-center gap-4 border-b border-home-border px-5 py-4 last:border-b-0"
            >
              <MemberAvatar
                name={displayName}
                profileImageUrl={m.profile_image_url}
                color={m.jt_color}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text">
                  {displayName}
                </div>
                <div className="truncate text-xs text-subtitle">
                  {m.email}{m.jt_family ? ` · ${m.jt_family}` : ''}
                </div>
              </div>
              {isCheckedIn ? (
                <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  ✓ Checked in
                </span>
              ) : (
                <button
                  onClick={() => checkInMember(m.id)}
                  disabled={saving === m.id}
                  className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition disabled:bg-[#9cb8d8]"
                >
                  {saving === m.id ? 'Saving…' : 'Check In'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
