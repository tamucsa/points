'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  exportHowdyWeekGuests,
  rematchGuestEmail,
  type HowdyWeekGuestProspect,
  type HowdyWeekGuestSort,
} from '@/app/actions/guests'
import { MembersTabs } from '@/app/(dashboard)/(officer)/officer/members/components/MembersTabs'
import PageHeader from '@/app/components/PageHeader'
import { inputClassName, OFFICER_MEMBERS_PAGE_SIZE } from '@/utils/constants'

interface MatchMember {
  id: string
  full_name: string
  email: string
}

interface HowdyEventOption {
  id: string
  name: string
}

interface RecentExport {
  id: string
  row_count: number
  created_at: string
  exporter_name: string | null
}

interface Props {
  prospects: HowdyWeekGuestProspect[]
  totalCount: number
  page: number
  totalPages: number
  semester: { name: string } | null
  query: string
  minEvents: number
  eventId: string
  sort: HowdyWeekGuestSort
  howdyEvents: HowdyEventOption[]
  matchMembers: MatchMember[]
  recentExports: RecentExport[]
  loadError?: string | null
}

function buildGuestsUrl(opts: {
  page?: number
  q?: string
  minEvents?: number
  eventId?: string
  sort?: string
}) {
  const params = new URLSearchParams()
  params.set('tab', 'guests')
  if ((opts.page ?? 1) > 1) params.set('page', String(opts.page))
  if (opts.q) params.set('q', opts.q)
  if ((opts.minEvents ?? 1) > 1) params.set('minEvents', String(opts.minEvents))
  if (opts.eventId && opts.eventId !== 'all') params.set('event', opts.eventId)
  if (opts.sort && opts.sort !== 'event_count') params.set('sort', opts.sort)
  return `/officer/members?${params.toString()}`
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function GuestsClient({
  prospects,
  totalCount,
  page,
  totalPages,
  semester,
  query,
  minEvents,
  eventId,
  sort,
  howdyEvents,
  matchMembers,
  recentExports,
  loadError = null,
}: Props) {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState(query)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [linkOpen, setLinkOpen] = useState<Record<string, boolean>>({})
  const [matchDraft, setMatchDraft] = useState<Record<string, string>>({})
  const [busyEmail, setBusyEmail] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * OFFICER_MEMBERS_PAGE_SIZE + 1
  const rangeEnd = Math.min(page * OFFICER_MEMBERS_PAGE_SIZE, totalCount)

  const applyFilters = (next: {
    page?: number
    q?: string
    minEvents?: number
    eventId?: string
    sort?: string
  }) => {
    router.push(
      buildGuestsUrl({
        page: next.page ?? 1,
        q: next.q ?? searchInput,
        minEvents: next.minEvents ?? minEvents,
        eventId: next.eventId ?? eventId,
        sort: next.sort ?? sort,
      }),
    )
  }

  const sortedMatchMembers = useMemo(
    () =>
      [...matchMembers].sort((a, b) =>
        a.full_name.localeCompare(b.full_name, undefined, {
          sensitivity: 'base',
        }),
      ),
    [matchMembers],
  )

  const handleRematch = async (email: string) => {
    const memberId = matchDraft[email]
    if (!memberId) return
    setBusyEmail(email)
    setMessage(null)
    const result = await rematchGuestEmail(email, memberId)
    setBusyEmail(null)
    if (!result.success) {
      setMessage({
        type: 'error',
        text: result.error ?? 'Failed to rematch guest.',
      })
      return
    }
    setMessage({
      type: 'success',
      text: `Linked ${result.linked} Howdy Week event${result.linked === 1 ? '' : 's'} for ${email}.`,
    })
    setLinkOpen(prev => {
      const next = { ...prev }
      delete next[email]
      return next
    })
    setMatchDraft(d => {
      const next = { ...d }
      delete next[email]
      return next
    })
    router.refresh()
  }

  const handleExport = async () => {
    setExporting(true)
    setMessage(null)
    const result = await exportHowdyWeekGuests({
      query,
      minEvents,
      eventId: eventId === 'all' ? null : eventId,
      sort,
    })
    setExporting(false)
    if (!result.success || !result.csv) {
      setMessage({
        type: 'error',
        text: result.error ?? 'Failed to export.',
      })
      return
    }

    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `howdy-week-guests-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)

    setMessage({
      type: 'success',
      text: `Exported ${result.rowCount} guest${result.rowCount === 1 ? '' : 's'}.`,
    })
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <PageHeader
        title="Members"
        subtitle={
          <>
            {semester?.name ?? 'No active semester'} · {totalCount} unmatched
            Howdy Week guest{totalCount === 1 ? '' : 's'}
          </>
        }
      />

      <MembersTabs active="guests" />

      <p className="mb-4 max-w-3xl text-sm leading-6 text-subtitle">
        Prospects who attended Howdy Week events this semester but are not linked
        to a member yet. Use this list for outreach, then rematch when they
        register or you find the right account.
      </p>

      <form
        className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap"
        onSubmit={e => {
          e.preventDefault()
          applyFilters({ page: 1, q: searchInput })
        }}
      >
        <input
          placeholder="Search by name or email…"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          className={`${inputClassName} lg:min-w-[16rem] lg:flex-1`}
        />
        <select
          value={String(minEvents)}
          onChange={e =>
            applyFilters({ page: 1, minEvents: Number(e.target.value) || 1 })
          }
          className={`${inputClassName} cursor-pointer lg:max-w-[10rem]`}
        >
          <option value="1">≥ 1 event</option>
          <option value="2">≥ 2 events</option>
          <option value="3">≥ 3 events</option>
        </select>
        <select
          value={eventId}
          onChange={e => applyFilters({ page: 1, eventId: e.target.value })}
          className={`${inputClassName} cursor-pointer lg:max-w-[14rem]`}
        >
          <option value="all">All Howdy Week events</option>
          {howdyEvents.map(ev => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={e => applyFilters({ page: 1, sort: e.target.value })}
          className={`${inputClassName} cursor-pointer lg:max-w-[12rem]`}
        >
          <option value="event_count">Sort: event count</option>
          <option value="name">Sort: name</option>
          <option value="last_attended">Sort: last attended</option>
        </select>
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-on-primary transition hover:bg-primary/90 sm:shrink-0"
        >
          Search
        </button>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || totalCount === 0}
          className="rounded-xl border border-home-border bg-surface px-4 py-3 text-sm font-semibold text-subtitle transition hover:border-primary/30 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:shrink-0"
        >
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </form>

      {loadError && (
        <p className="mb-3 text-sm text-red-600">{loadError}</p>
      )}

      {message && (
        <p
          className={`mb-3 text-sm ${
            message.type === 'success' ? 'text-green-700' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}

      {recentExports.length > 0 && (
        <p className="mb-3 text-xs text-subtitle">
          Recent exports:{' '}
          {recentExports
            .map(
              row =>
                `${row.exporter_name ?? 'Officer'} (${row.row_count}) ${formatDate(row.created_at)}`,
            )
            .join(' · ')}
        </p>
      )}

      <div className="overflow-hidden rounded-4xl border border-home-border bg-surface shadow-sm">
        <div className="hidden border-b border-home-border bg-bg px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-subtitle md:grid md:grid-cols-[1.5fr_1.4fr_5rem_5.5rem_8rem] md:gap-3">
          <div>Name</div>
          <div>Email</div>
          <div>Year</div>
          <div className="text-right">Events</div>
          <div>Last attended</div>
        </div>

        {prospects.length === 0 && (
          <div className="px-8 py-10 text-center text-sm text-subtitle">
            No unmatched Howdy Week guests this semester.
          </div>
        )}

        {prospects.map(row => {
          const displayName = row.full_name || '—'
          const isOpen = expanded[row.email] === true
          const isLinkOpen = linkOpen[row.email] === true
          const selectedMemberId = matchDraft[row.email] ?? ''
          const isBusy = busyEmail === row.email
          return (
            <div
              key={row.email}
              className="border-b border-home-border px-5 py-3 last:border-b-0"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[1.5fr_1.4fr_5rem_5.5rem_8rem] md:items-center md:gap-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      className="text-left text-sm font-medium text-text hover:text-primary"
                      onClick={() =>
                        setExpanded(prev => ({
                          ...prev,
                          [row.email]: !prev[row.email],
                        }))
                      }
                    >
                      {displayName}
                      <span className="ml-2 text-[11px] font-normal text-subtitle">
                        {isOpen ? 'Hide events' : 'Show events'}
                      </span>
                    </button>
                    {row.other_names.length > 0 && (
                      <div className="mt-0.5 text-[11px] text-subtitle">
                        also: {row.other_names.join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="truncate text-xs text-subtitle md:text-sm">
                    {row.email}
                  </div>
                  <div className="text-sm text-subtitle">
                    {row.graduation_year ?? '—'}
                  </div>
                  <div className="text-sm font-semibold text-text md:text-right">
                    {row.event_count}
                  </div>
                  <div className="text-sm text-subtitle">
                    {formatDate(row.last_attended_at)}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setLinkOpen(prev => ({
                      ...prev,
                      [row.email]: !prev[row.email],
                    }))
                  }
                  className={`inline-flex shrink-0 items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    isLinkOpen
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-home-border bg-surface text-subtitle hover:border-primary/30 hover:text-primary'
                  }`}
                  aria-expanded={isLinkOpen}
                >
                  {isLinkOpen ? 'Cancel' : 'Link member'}
                </button>
              </div>

              {isOpen && (
                <ul className="mt-3 space-y-1 rounded-xl bg-bg px-3 py-2 text-xs text-subtitle">
                  {row.events.map(ev => (
                    <li key={ev.id}>
                      <span className="font-medium text-text">{ev.name}</span>
                      {ev.starts_at ? ` · ${formatDate(ev.starts_at)}` : ''}
                    </li>
                  ))}
                </ul>
              )}

              {isLinkOpen && (
                <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-home-border/80 bg-bg/60 p-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`rematch-${row.email}`}
                      className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-subtitle"
                    >
                      Select member
                    </label>
                    <select
                      id={`rematch-${row.email}`}
                      className={`${inputClassName} py-2.5`}
                      value={selectedMemberId}
                      onChange={e =>
                        setMatchDraft(d => ({
                          ...d,
                          [row.email]: e.target.value,
                        }))
                      }
                      aria-label={`Link ${row.email} to a member`}
                    >
                      <option value="">Select member…</option>
                      {sortedMatchMembers.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    disabled={!selectedMemberId || isBusy}
                    onClick={() => void handleRematch(row.email)}
                    className="inline-flex shrink-0 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-disabled"
                  >
                    {isBusy ? 'Linking…' : 'Link & check in'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {totalCount > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-subtitle">
            Showing {rangeStart}–{rangeEnd} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <button
                type="button"
                onClick={() => applyFilters({ page: page - 1 })}
                className="rounded-xl border border-home-border bg-surface px-4 py-2 text-sm font-medium text-subtitle transition hover:border-primary/30 hover:text-primary"
              >
                Previous
              </button>
            ) : (
              <span className="rounded-xl border border-home-border px-4 py-2 text-sm text-subtitle/40">
                Previous
              </span>
            )}
            <span className="px-2 text-sm text-subtitle">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <button
                type="button"
                onClick={() => applyFilters({ page: page + 1 })}
                className="rounded-xl border border-home-border bg-surface px-4 py-2 text-sm font-medium text-subtitle transition hover:border-primary/30 hover:text-primary"
              >
                Next
              </button>
            ) : (
              <span className="rounded-xl border border-home-border px-4 py-2 text-sm text-subtitle/40">
                Next
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
