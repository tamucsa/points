'use client'

import { useState } from 'react'
import { closeActiveSemester, startSemester } from '@/app/actions/semesters'

interface Year {
  id: string
  label: string
}

interface Semester {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  year_id: string
  years: { label: string } | { label: string }[] | null
}

function yearLabel(years: Semester['years']) {
  if (!years) return null
  return Array.isArray(years) ? years[0]?.label ?? null : years.label
}

interface Props {
  semesters: Semester[]
  years: Year[]
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function SemesterAdminClient({ semesters: initialSemesters, years }: Props) {
  const [semesters, setSemesters] = useState(initialSemesters)
  const [closing, setClosing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
    yearId: years[0]?.id ?? '',
  })

  const activeSemester = semesters.find(s => s.is_active)

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

      <div className="mb-6 rounded-4xl border border-home-border bg-white p-7 shadow-sm">
        <h2 className="mb-2 text-base font-semibold text-text">Active semester</h2>
        {activeSemester ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-medium text-text">{activeSemester.name}</div>
              <div className="text-sm text-subtitle">
                {formatDate(activeSemester.start_date)} – {formatDate(activeSemester.end_date)}
                {yearLabel(activeSemester.years) ? ` · ${yearLabel(activeSemester.years)}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void handleClose()}
              disabled={closing}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {closing ? 'Closing…' : 'Close semester'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-subtitle">No active semester. Start one below before officers create events.</p>
        )}
      </div>

      {!activeSemester && (
        <div className="mb-6 rounded-4xl border border-home-border bg-white p-7 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-text">Start new semester</h2>
          <form onSubmit={handleStart} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
              <span className="font-medium text-text">Name</span>
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
                  <option key={year.id} value={year.id}>{year.label}</option>
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
      )}

      <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
        <div className="border-b border-home-border px-5 py-4 text-sm font-semibold text-text">
          Semester history
        </div>
        {semesters.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-subtitle">No semesters yet.</div>
        ) : (
          semesters.map(semester => (
            <div
              key={semester.id}
              className="flex flex-col gap-1 border-b border-home-border px-5 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="text-sm font-medium text-text">{semester.name}</div>
                <div className="text-xs text-subtitle">
                  {formatDate(semester.start_date)} – {formatDate(semester.end_date)}
                  {yearLabel(semester.years) ? ` · ${yearLabel(semester.years)}` : ''}
                </div>
              </div>
              <span
                className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                  semester.is_active
                    ? 'bg-primary/10 text-primary'
                    : 'bg-home-border/60 text-subtitle'
                }`}
              >
                {semester.is_active ? 'Active' : 'Closed'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
