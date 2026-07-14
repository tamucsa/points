'use client'

import { useMemo, useState } from 'react'
import { officerCheckIn, officerRemoveCheckIn } from '@/app/actions/attendance'
import BackLink from '@/app/components/BackLink'
import EmptyState from '@/app/components/EmptyState'
import PageHeader from '@/app/components/PageHeader'
import MemberAvatar from '@/app/components/MemberAvatar'
import { UserX, Users } from 'lucide-react'

interface Event {
  id: string
  name: string
  category: string
  point_value: number
  starts_at: string
  ends_at: string | null
  semester_id: string
  check_in_type: string
  scope: string
  jt_family_name: string | null
  is_mixer: boolean
}

interface Member {
  id: string
  full_name: string
  email: string
  profile_image_url: string | null
  jt_family_id: string | null
  jt_family_name: string | null
  jt_color: string | null
  role_label: 'Member' | 'Officer'
}

interface TabFamily {
  id: string
  name: string
  color: string | null
}

interface Props {
  event: Event
  members: Member[]
  checkedInIds: string[]
  tabFamilies: TabFamily[]
  defaultTabId: string | null
}

export default function OfficerCheckinClient({
  event,
  members,
  checkedInIds,
  tabFamilies,
  defaultTabId,
}: Props) {
  const [search, setSearch] = useState('')
  const [checkedIn, setCheckedIn] = useState(() => new Set(checkedInIds))
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [uncheckTarget, setUncheckTarget] = useState<Member | null>(null)
  const [uncheckError, setUncheckError] = useState<string | null>(null)
  const [activeTabId, setActiveTabId] = useState<string | null>(defaultTabId)
  const isJtSpecific = event.scope === 'jt_specific'
  const showTabs = event.scope === 'jt_shared' && tabFamilies.length > 0

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return members.filter(m => {
      if (showTabs && activeTabId && m.jt_family_id !== activeTabId) return false
      return (
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
      )
    })
  }, [members, search, showTabs, activeTabId])

  const tabCheckedInCount = useMemo(() => {
    if (!showTabs || !activeTabId) return null
    return members.filter(m => m.jt_family_id === activeTabId && checkedIn.has(m.id)).length
  }, [showTabs, activeTabId, members, checkedIn])

  const closeUncheckModal = () => {
    if (saving) return
    setUncheckTarget(null)
    setUncheckError(null)
  }

  const checkInMember = async (memberId: string) => {
    if (checkedIn.has(memberId)) return
    setError(null)
    setNotice(null)
    setSaving(memberId)

    const result = await officerCheckIn(event.id, event.semester_id, memberId)

    if (!result.success) {
      setError(result.error ?? 'Check-in failed.')
      setSaving(null)
      return
    }

    setCheckedIn(prev => new Set([...prev, memberId]))
    if (result.counted === false) {
      const memberName = members.find(m => m.id === memberId)?.full_name ?? 'Member'
      setNotice(
        `${memberName} is checked in, but this attendance does not add points under current caps.`,
      )
    }
    setSaving(null)
  }

  const confirmRemoveCheckIn = async () => {
    if (!uncheckTarget) return

    setUncheckError(null)
    setSaving(uncheckTarget.id)

    const result = await officerRemoveCheckIn(event.id, uncheckTarget.id)

    setSaving(null)
    if (!result.success) {
      setUncheckError(result.error ?? 'Failed to remove check-in.')
      return
    }

    setCheckedIn(prev => {
      const next = new Set(prev)
      next.delete(uncheckTarget.id)
      return next
    })
    setUncheckTarget(null)
    setUncheckError(null)
  }

  const subtitle = (() => {
    if (isJtSpecific && event.jt_family_name) {
      return `${event.name} · ${event.jt_family_name} only · ${checkedIn.size} checked in`
    }
    if (showTabs && event.is_mixer) {
      return `${event.name} · ${tabFamilies.length} families · ${checkedIn.size} checked in`
    }
    if (showTabs) {
      return `${event.name} · all Jiatings · ${checkedIn.size} checked in`
    }
    return `${event.name} · ${checkedIn.size} checked in`
  })()

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 lg:px-8">
      <BackLink
        href={`/officer/events/${event.id}`}
        label="Back to Event"
        className="mb-5"
      />

      <PageHeader title="Check In Members" subtitle={subtitle} />

      {showTabs && (
        <div
          className="mb-4 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Jiating families"
        >
          {tabFamilies.map(family => {
            const active = family.id === activeTabId
            const count = members.filter(
              m => m.jt_family_id === family.id && checkedIn.has(m.id),
            ).length
            return (
              <button
                key={family.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTabId(family.id)}
                className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-home-border bg-white text-subtitle hover:border-primary/30 hover:text-text'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: family.color ?? '#4779B8' }}
                    aria-hidden
                  />
                  {family.name}
                  <span className={active ? 'text-primary/70' : 'text-subtitle/80'}>
                    {count}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <input
        placeholder="Search by name or email…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="mb-4 w-full rounded-xl border border-home-border bg-white px-4 py-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />

      {showTabs && activeTabId && tabCheckedInCount != null && (
        <p className="mb-3 text-xs text-subtitle">
          {tabFamilies.find(f => f.id === activeTabId)?.name}: {tabCheckedInCount} checked in
          {search ? ' (search filters this tab)' : ''}
        </p>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border border-[#f5b0b0] bg-[#fff4f4] p-3">
          <p className="text-sm text-[#c94b4b]">{error}</p>
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-sm text-subtitle">{notice}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
        {filtered.length === 0 && (
          <EmptyState
            icon={Users}
            title="No members found"
            description={
              search
                ? 'Try a different name or email.'
                : isJtSpecific && event.jt_family_name
                  ? `No active members in ${event.jt_family_name}.`
                  : showTabs
                    ? 'No active members in this Jiating.'
                    : 'No active members to check in.'
            }
            compact
          />
        )}
        {filtered.map(m => {
          const isCheckedIn = checkedIn.has(m.id)
          const displayName = m.full_name
          const isSaving = saving === m.id
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
                  {m.email} · {m.role_label}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isCheckedIn) {
                    setUncheckError(null)
                    setUncheckTarget(m)
                    return
                  }
                  void checkInMember(m.id)
                }}
                disabled={isSaving}
                className={
                  isCheckedIn
                    ? 'shrink-0 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary transition hover:border-primary/50 hover:bg-primary/20 disabled:opacity-60'
                    : 'shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#35679e] disabled:bg-[#9cb8d8]'
                }
              >
                {isSaving ? 'Saving…' : isCheckedIn ? '✓ Checked In' : 'Check In'}
              </button>
            </div>
          )
        })}
      </div>

      {uncheckTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeUncheckModal}
        >
          <div
            className="w-full max-w-md rounded-4xl border border-home-border bg-white p-6 shadow-xl sm:p-8"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-checkin-title"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff4f4]">
              <UserX className="size-5 text-[#c94b4b]" aria-hidden />
            </div>
            <h2 id="remove-checkin-title" className="text-center text-lg font-bold text-text">
              Remove check-in?
            </h2>
            <p className="mt-2 text-center text-sm font-semibold text-text">
              {uncheckTarget.full_name}
            </p>
            <p className="mt-3 text-center text-sm leading-6 text-subtitle">
              This removes their attendance for {event.name} and deducts{' '}
              {event.point_value} point{event.point_value === 1 ? '' : 's'} from their total.
            </p>
            {uncheckError && (
              <p className="mt-4 rounded-2xl border border-[#f5b0b0] bg-[#fff4f4] px-4 py-3 text-center text-sm text-[#c94b4b]">
                {uncheckError}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={!!saving}
                onClick={closeUncheckModal}
                className="rounded-xl border border-home-border bg-white px-4 py-2.5 text-sm font-semibold text-subtitle transition hover:border-primary/30 hover:bg-bg hover:text-text disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!!saving}
                onClick={() => void confirmRemoveCheckIn()}
                className="rounded-xl border border-[#f5b0b0] bg-[#fff4f4] px-4 py-2.5 text-sm font-semibold text-[#c94b4b] transition hover:border-[#e88a8a] hover:bg-[#ffe8e8] disabled:opacity-60"
              >
                {saving ? 'Removing…' : 'Remove Check-In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
