'use client'

import { useState } from 'react'
import {
  closeActiveSemester,
  startSemester,
  type SemesterListItem,
} from '@/app/actions/semesters'
import JtFamilyBadge from '@/app/(dashboard)/leaderboard/components/JtFamilyBadge'

interface Year {
  id: string
  name: string
}

interface Props {
  semesters: SemesterListItem[]
  years: Year[]
}

function yearLabel(years: SemesterListItem['years']) {
  if (!years) return '—'
  return Array.isArray(years) ? years[0]?.name ?? '—' : years.name
}

function formatDateRange(start: string, end: string) {
  const startDate = new Date(`${start}T12:00:00`)
  const endDate = new Date(`${end}T12:00:00`)
  const sameYear = startDate.getFullYear() === endDate.getFullYear()

  const startLabel = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  const endLabel = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return `${startLabel} – ${endLabel}`
}

function SemesterMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-baseline gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[6.5rem_1fr]">
      <dt className="text-subtitle">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  )
}

function SemesterCard({
  semester,
  onClose,
  closing,
}: {
  semester: SemesterListItem
  onClose?: () => void
  closing?: boolean
}) {
  const memberLabel = semester.is_active
    ? null
    : semester.memberCount > 0
      ? `${semester.memberCount} member${semester.memberCount === 1 ? '' : 's'} archived`
      : null

  return (
    <article
      className={`rounded-3xl border p-5 ${
        semester.is_active
          ? 'border-primary/25 bg-primary/[0.03] shadow-sm'
          : 'border-home-border bg-white'
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text">{semester.name}</h3>
          {semester.is_active && (
            <p className="mt-1 text-xs text-primary">Currently active for points and events</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            semester.is_active
              ? 'bg-primary/10 text-primary'
              : 'bg-home-border/60 text-subtitle'
          }`}
        >
          {semester.is_active ? 'Active' : 'Closed'}
        </span>
      </div>

      <dl className="space-y-2.5">
        <SemesterMeta label="School year" value={yearLabel(semester.years)} />
        <SemesterMeta label="Dates" value={formatDateRange(semester.start_date, semester.end_date)} />
        <SemesterMeta
          label="Events"
          value={`${semester.eventCount} event${semester.eventCount === 1 ? '' : 's'}`}
        />
        {memberLabel && <SemesterMeta label="Members" value={memberLabel} />}
        <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2 text-sm sm:grid-cols-[6.5rem_1fr]">
          <dt className="pt-0.5 text-subtitle">Jiatings</dt>
          <dd>
            {semester.jtFamilies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {semester.jtFamilies.map(jt => (
                  <JtFamilyBadge key={jt.name} name={jt.name} color={jt.color} />
                ))}
              </div>
            ) : (
              <span className="text-subtitle">—</span>
            )}
          </dd>
        </div>
      </dl>

      {semester.is_active && onClose && (
        <button
          type="button"
          onClick={onClose}
          disabled={closing}
          className="mt-5 w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {closing ? 'Closing…' : 'Close semester'}
        </button>
      )}
    </article>
  )
}

export default function SemesterAdminClient({ semesters: initialSemesters, years }: Props) {
  const [semesters, setSemesters] = useState(initialSemesters)
  const [closing, setClosing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [pastOpen, setPastOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    yearId: years[0]?.id ?? '',
  })

  const activeSemester = semesters.find(s => s.is_active)
  const pastSemesters = semesters.filter(s => !s.is_active)

  const handleClose = async () => {
    if (!activeSemester) return
    if (!window.confirm(`Close "${activeSemester.name}"? This archives semester totals and cannot be undone from the UI.`)) {
      return
    }

    setClosing(true)
    setMessage(null)

    const result = await closeActiveSemester()
    setClosing(false)

    if (!result.success) {
      setMessage({ type: 'error', text: result.error ?? 'Failed to close semester.' })
      return
    }

    setSemesters(prev =>
      prev.map(s => (s.id === activeSemester.id ? { ...s, is_active: false } : s)),
    )
    setPastOpen(true)
    setMessage({
      type: 'success',
      text: `Closed "${result.closedSemester}". Start the next semester when ready.`,
    })
  }

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    setStarting(true)
    setMessage(null)

    const result = await startSemester(form)
    setStarting(false)

    if (!result.success) {
      setMessage({ type: 'error', text: result.error ?? 'Failed to start semester.' })
      return
    }

    window.location.reload()
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-text">Semester Admin</h1>
        <p className="mt-1 text-sm text-subtitle">
          Close the current term before starting the next. Leaderboards and events use the active semester.
        </p>
      </div>

      {message && (
        <div
          className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-600'
          }`}
        >
          {message.text}
        </div>
      )}

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.06em] text-subtitle">
          Current
        </h2>
        {activeSemester ? (
          <SemesterCard
            semester={activeSemester}
            onClose={() => void handleClose()}
            closing={closing}
          />
        ) : (
          <div className="rounded-3xl border border-dashed border-home-border bg-bg px-5 py-8 text-center text-sm text-subtitle">
            No active semester. Start one below before officers create events.
          </div>
        )}
      </section>

      {!activeSemester && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.06em] text-subtitle">
            Start new semester
          </h2>
          <div className="rounded-3xl border border-home-border bg-white p-6 shadow-sm">
            <form onSubmit={handleStart} className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="font-medium text-text">Semester name</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Fall 2026"
                  className="rounded-xl border border-home-border bg-white px-3 py-2.5 text-text shadow-sm"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-text">Start date</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="rounded-xl border border-home-border bg-white px-3 py-2.5 text-text shadow-sm"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-text">End date</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="rounded-xl border border-home-border bg-white px-3 py-2.5 text-text shadow-sm"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="font-medium text-text">School year</span>
                <select
                  value={form.yearId}
                  onChange={e => setForm(f => ({ ...f, yearId: e.target.value }))}
                  className="rounded-xl border border-home-border bg-white px-3 py-2.5 text-text shadow-sm"
                  required
                >
                  <option value="">Select year…</option>
                  {years.map(year => (
                    <option key={year.id} value={year.id}>{year.name}</option>
                  ))}
                </select>
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={starting || years.length === 0}
                  className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#9cb8d8]"
                >
                  {starting ? 'Starting…' : 'Start semester'}
                </button>
              </div>
            </form>
          </div>
        </section>
      )}

      {pastSemesters.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setPastOpen(open => !open)}
            aria-expanded={pastOpen}
            className="flex w-full items-center justify-between rounded-2xl border border-home-border bg-white px-4 py-3 text-left shadow-sm transition hover:border-primary/30"
          >
            <span className="text-sm font-semibold text-text">
              Past semesters
              <span className="ml-2 font-normal text-subtitle">({pastSemesters.length})</span>
            </span>
            <span
              className={`text-subtitle transition-transform ${pastOpen ? 'rotate-180' : ''}`}
              aria-hidden
            >
              ▾
            </span>
          </button>

          {pastOpen && (
            <div className="mt-3 grid gap-3">
              {pastSemesters.map(semester => (
                <SemesterCard key={semester.id} semester={semester} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
