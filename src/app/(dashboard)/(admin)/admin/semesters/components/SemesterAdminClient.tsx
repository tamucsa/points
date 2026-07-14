'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  bootstrapYearPlaceholders,
  closeActiveSemester,
  createJtFamily,
  deactivateJtFamily,
  previewStartSemesterYear,
  startSemester,
  updateJtFamily,
  updateSemester,
  type JtInput,
  type SemesterJtFamily,
  type SemesterListItem,
} from '@/app/actions/semesters'
import JtFamilyBadge from '@/app/(dashboard)/leaderboard/components/JtFamilyBadge'
import ColorPickerField from '@/app/components/ColorPickerField'
import { schoolYearFromStartDate } from '@/utils/schoolYear'

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

function randomColor() {
  const hue = Math.floor(Math.random() * 360)
  const sat = 45 + Math.floor(Math.random() * 25)
  const light = 42 + Math.floor(Math.random() * 12)
  const s = sat / 100
  const l = light / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1))
  const m = l - c / 2
  let r = 0
  let g = 0
  let b = 0
  if (hue < 60) { r = c; g = x }
  else if (hue < 120) { r = x; g = c }
  else if (hue < 180) { g = c; b = x }
  else if (hue < 240) { g = x; b = c }
  else if (hue < 300) { r = x; b = c }
  else { r = c; b = x }
  const hex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

function defaultCustomizeRows(): JtInput[] {
  return Array.from({ length: 6 }, (_, i) => ({
    name: `JT ${i + 1}`,
    color: randomColor(),
  }))
}

function SemesterMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-baseline gap-x-3 gap-y-0.5 text-sm sm:grid-cols-[6.5rem_1fr]">
      <dt className="text-subtitle">{label}</dt>
      <dd className="text-text">{value}</dd>
    </div>
  )
}

const inputClass =
  'rounded-xl border border-home-border bg-white px-3 py-2.5 text-text shadow-sm'
const btnPrimary =
  'rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#9cb8d8]'
const btnSecondary =
  'rounded-xl border border-home-border bg-white px-3 py-2 text-sm font-medium text-text transition hover:border-primary/40 disabled:opacity-60'
const btnDanger =
  'rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'

function PastSemesterCard({ semester }: { semester: SemesterListItem }) {
  const memberLabel =
    semester.memberCount > 0
      ? `${semester.memberCount} member${semester.memberCount === 1 ? '' : 's'} archived`
      : null

  return (
    <article className="rounded-3xl border border-home-border bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-text">{semester.name}</h3>
        <span className="shrink-0 rounded-full bg-home-border/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-subtitle">
          Closed
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
                  <JtFamilyBadge key={jt.id ?? jt.name} name={jt.name} color={jt.color} />
                ))}
              </div>
            ) : (
              <span className="text-subtitle">—</span>
            )}
          </dd>
        </div>
      </dl>
    </article>
  )
}

function ActiveSemesterCard({
  semester,
  onClose,
  closing,
  onUpdated,
  onMessage,
}: {
  semester: SemesterListItem
  onClose: () => void
  closing: boolean
  onUpdated: (next: SemesterListItem) => void
  onMessage: (msg: { type: 'success' | 'error'; text: string } | null) => void
}) {
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaSaving, setMetaSaving] = useState(false)
  const [metaForm, setMetaForm] = useState({
    name: semester.name,
    startDate: semester.start_date,
    endDate: semester.end_date,
  })

  const [jtFamilies, setJtFamilies] = useState(semester.jtFamilies)
  const [editingJtId, setEditingJtId] = useState<string | null>(null)
  const [jtDraft, setJtDraft] = useState({ name: '', color: '#4f6ef7' })
  const [jtBusy, setJtBusy] = useState(false)
  const [addingJt, setAddingJt] = useState(false)
  const [newJt, setNewJt] = useState({ name: '', color: randomColor() })
  const [bootstrapping, setBootstrapping] = useState(false)

  useEffect(() => {
    setJtFamilies(semester.jtFamilies)
    setMetaForm({
      name: semester.name,
      startDate: semester.start_date,
      endDate: semester.end_date,
    })
  }, [semester])

  const derivedYear = schoolYearFromStartDate(metaForm.startDate)

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault()
    setMetaSaving(true)
    onMessage(null)
    const result = await updateSemester({
      id: semester.id,
      name: metaForm.name,
      startDate: metaForm.startDate,
      endDate: metaForm.endDate,
    })
    setMetaSaving(false)
    if (!result.success) {
      onMessage({ type: 'error', text: result.error ?? 'Failed to update semester.' })
      return
    }
    onUpdated({
      ...semester,
      name: metaForm.name.trim(),
      start_date: metaForm.startDate,
      end_date: metaForm.endDate,
      year_id: result.yearId ?? semester.year_id,
      years: result.yearName ? { name: result.yearName } : semester.years,
    })
    setEditingMeta(false)
    onMessage({ type: 'success', text: 'Semester updated.' })
  }

  const beginEditJt = (jt: SemesterJtFamily) => {
    if (!jt.id) return
    setAddingJt(false)
    setEditingJtId(jt.id)
    setJtDraft({ name: jt.name, color: jt.color ?? '#4f6ef7' })
  }

  const handleSaveJt = async () => {
    if (!editingJtId) return
    setJtBusy(true)
    onMessage(null)
    const result = await updateJtFamily({
      id: editingJtId,
      name: jtDraft.name,
      color: jtDraft.color,
    })
    setJtBusy(false)
    if (!result.success || !result.family) {
      onMessage({ type: 'error', text: result.error ?? 'Failed to update Jiating.' })
      return
    }
    const family = result.family
    const next = jtFamilies.map(j =>
      j.id === family.id
        ? { id: family.id, name: family.name, color: family.color, year_id: family.year_id }
        : j,
    )
    setJtFamilies(next)
    onUpdated({
      ...semester,
      jtFamilies: next,
      jtYearMismatch: false,
    })
    setEditingJtId(null)
    onMessage({ type: 'success', text: `Updated "${family.name}".` })
  }

  const handleAddJt = async (e: React.FormEvent) => {
    e.preventDefault()
    setJtBusy(true)
    onMessage(null)
    const result = await createJtFamily(newJt)
    setJtBusy(false)
    if (!result.success || !result.family) {
      onMessage({ type: 'error', text: result.error ?? 'Failed to create Jiating.' })
      return
    }
    const family: SemesterJtFamily = {
      id: result.family.id,
      name: result.family.name,
      color: result.family.color,
      year_id: result.family.year_id,
    }
    const next = [...jtFamilies, family].sort((a, b) => a.name.localeCompare(b.name))
    setJtFamilies(next)
    onUpdated({ ...semester, jtFamilies: next, jtYearMismatch: false })
    setAddingJt(false)
    setNewJt({ name: '', color: randomColor() })
    onMessage({ type: 'success', text: `Created "${family.name}".` })
  }

  const handleDeactivateJt = async (jt: SemesterJtFamily) => {
    if (!jt.id) return
    if (!window.confirm(`Deactivate "${jt.name}"? Members kept on this Jiating stay linked, but it will no longer appear as active.`)) {
      return
    }
    setJtBusy(true)
    onMessage(null)
    const result = await deactivateJtFamily(jt.id)
    setJtBusy(false)
    if (!result.success) {
      onMessage({ type: 'error', text: result.error ?? 'Failed to deactivate Jiating.' })
      return
    }
    const next = jtFamilies.filter(j => j.id !== jt.id)
    setJtFamilies(next)
    onUpdated({ ...semester, jtFamilies: next })
    onMessage({ type: 'success', text: `Deactivated "${jt.name}".` })
  }

  const handleBootstrap = async () => {
    if (
      !window.confirm(
        'Replace currently active Jiatings with JT 1–JT 6 placeholders for this school year? Prior active families will be deactivated.',
      )
    ) {
      return
    }
    setBootstrapping(true)
    onMessage(null)
    const result = await bootstrapYearPlaceholders()
    setBootstrapping(false)
    if (!result.success) {
      onMessage({ type: 'error', text: result.error ?? 'Failed to create placeholders.' })
      return
    }
    window.location.reload()
  }

  return (
    <article className="rounded-3xl border border-primary/25 bg-primary/[0.03] p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-text">{semester.name}</h3>
          <p className="mt-1 text-xs text-primary">Currently active for points and events</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Active
        </span>
      </div>

      {editingMeta ? (
        <form onSubmit={handleSaveMeta} className="mb-5 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm sm:col-span-2">
            <span className="font-medium text-text">Semester name</span>
            <input
              className={inputClass}
              value={metaForm.name}
              onChange={e => setMetaForm(f => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-text">Start date</span>
            <input
              type="date"
              className={inputClass}
              value={metaForm.startDate}
              onChange={e => setMetaForm(f => ({ ...f, startDate: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-text">End date</span>
            <input
              type="date"
              className={inputClass}
              value={metaForm.endDate}
              onChange={e => setMetaForm(f => ({ ...f, endDate: e.target.value }))}
              required
            />
          </label>
          <p className="text-xs text-subtitle sm:col-span-2">
            School year from start date: <span className="font-medium text-text">{derivedYear || '—'}</span>
          </p>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={metaSaving} className={btnPrimary}>
              {metaSaving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={metaSaving}
              onClick={() => {
                setEditingMeta(false)
                setMetaForm({
                  name: semester.name,
                  startDate: semester.start_date,
                  endDate: semester.end_date,
                })
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <dl className="mb-4 space-y-2.5">
          <SemesterMeta label="School year" value={yearLabel(semester.years)} />
          <SemesterMeta label="Dates" value={formatDateRange(semester.start_date, semester.end_date)} />
          <SemesterMeta
            label="Events"
            value={`${semester.eventCount} event${semester.eventCount === 1 ? '' : 's'}`}
          />
        </dl>
      )}

      {!editingMeta && (
        <button type="button" className={`${btnSecondary} mb-5`} onClick={() => setEditingMeta(true)}>
          Edit semester
        </button>
      )}

      <div className="border-t border-home-border/80 pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-text">Jiatings (school year)</h4>
          {!addingJt && !editingJtId && (
            <button
              type="button"
              className={btnSecondary}
              disabled={jtBusy || semester.jtYearMismatch}
              onClick={() => {
                setAddingJt(true)
                setNewJt({ name: '', color: randomColor() })
              }}
            >
              Add Jiating
            </button>
          )}
        </div>

        {semester.jtYearMismatch && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">Active Jiatings are not linked to this school year</p>
            <p className="mt-1 text-amber-800/90">
              They are likely leftovers from a prior term. Replace them with JT 1–JT 6 placeholders,
              then rename once themes are decided.
            </p>
            <button
              type="button"
              className={`${btnPrimary} mt-3`}
              disabled={bootstrapping}
              onClick={() => void handleBootstrap()}
            >
              {bootstrapping ? 'Replacing…' : 'Replace with JT 1–6 placeholders'}
            </button>
          </div>
        )}

        <ul className="space-y-2">
          {jtFamilies.map(jt => (
            <li
              key={jt.id ?? jt.name}
              className="rounded-2xl border border-home-border bg-white px-3 py-2.5"
            >
              {editingJtId === jt.id ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="flex flex-1 flex-col gap-1 text-sm">
                    <span className="font-medium text-text">Name</span>
                    <input
                      className={inputClass}
                      value={jtDraft.name}
                      onChange={e => setJtDraft(d => ({ ...d, name: e.target.value }))}
                    />
                  </label>
                  <ColorPickerField
                    value={jtDraft.color}
                    onChange={color => setJtDraft(d => ({ ...d, color }))}
                    disabled={jtBusy}
                  />
                  <div className="flex gap-2">
                    <button type="button" className={btnPrimary} disabled={jtBusy} onClick={() => void handleSaveJt()}>
                      Save
                    </button>
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={jtBusy}
                      onClick={() => setEditingJtId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <JtFamilyBadge name={jt.name} color={jt.color} />
                  {!semester.jtYearMismatch && jt.id && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={btnSecondary}
                        disabled={jtBusy}
                        onClick={() => beginEditJt(jt)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 disabled:opacity-60"
                        disabled={jtBusy}
                        onClick={() => void handleDeactivateJt(jt)}
                      >
                        Deactivate
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
          {jtFamilies.length === 0 && !semester.jtYearMismatch && (
            <li className="text-sm text-subtitle">No Jiatings for this school year yet.</li>
          )}
        </ul>

        {addingJt && (
          <form onSubmit={handleAddJt} className="mt-3 flex flex-col gap-2 rounded-2xl border border-dashed border-home-border bg-white p-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              <span className="font-medium text-text">Name</span>
              <input
                className={inputClass}
                value={newJt.name}
                onChange={e => setNewJt(d => ({ ...d, name: e.target.value }))}
                placeholder="New Jiating"
                required
              />
            </label>
            <ColorPickerField
              value={newJt.color}
              onChange={color => setNewJt(d => ({ ...d, color }))}
              disabled={jtBusy}
            />
            <div className="flex gap-2">
              <button type="submit" className={btnPrimary} disabled={jtBusy}>
                Create
              </button>
              <button type="button" className={btnSecondary} disabled={jtBusy} onClick={() => setAddingJt(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        disabled={closing}
        className={`${btnDanger} mt-5 w-full sm:w-auto`}
      >
        {closing ? 'Closing…' : 'Close semester'}
      </button>
    </article>
  )
}

export default function SemesterAdminClient({
  semesters: initialSemesters,
}: {
  semesters: SemesterListItem[]
}) {
  const [semesters, setSemesters] = useState(initialSemesters)
  const [closing, setClosing] = useState(false)
  const [starting, setStarting] = useState(false)
  const [pastOpen, setPastOpen] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
  })
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [customJts, setCustomJts] = useState<JtInput[]>(() => defaultCustomizeRows())
  const [yearPreview, setYearPreview] = useState<{
    yearName: string
    yearHasJts: boolean
  } | null>(null)

  const activeSemester = semesters.find(s => s.is_active)
  const pastSemesters = semesters.filter(s => !s.is_active)

  const previewYearName = useMemo(
    () => (form.startDate ? schoolYearFromStartDate(form.startDate) : ''),
    [form.startDate],
  )

  useEffect(() => {
    if (!form.startDate) {
      setYearPreview(null)
      return
    }
    let cancelled = false
    void previewStartSemesterYear(form.startDate).then(result => {
      if (cancelled || result.error) return
      setYearPreview({ yearName: result.yearName, yearHasJts: result.yearHasJts })
    })
    return () => {
      cancelled = true
    }
  }, [form.startDate])

  const willCreateJts = yearPreview ? !yearPreview.yearHasJts : Boolean(previewYearName)

  const handleClose = async () => {
    if (!activeSemester) return
    const startMonth = Number(activeSemester.start_date.slice(5, 7))
    const isSpringClose = startMonth >= 1 && startMonth < 8
    const confirmMsg = isSpringClose
      ? `Close "${activeSemester.name}"? This archives semester totals and clears every active member’s Jiating (status stays active). This cannot be undone from the UI.`
      : `Close "${activeSemester.name}"? This archives semester totals and cannot be undone from the UI. Jiating assignments are kept for Spring.`
    if (!window.confirm(confirmMsg)) {
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
      text: result.clearedJiatings
        ? `Closed "${result.closedSemester}" and cleared Jiating assignments. Start the next semester when ready.`
        : `Closed "${result.closedSemester}". Start the next semester when ready.`,
    })
  }

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault()
    setStarting(true)
    setMessage(null)

    const result = await startSemester({
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      jiatings: willCreateJts && customizeOpen ? customJts : undefined,
    })
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
          Jiatings belong to the school year and carry from Fall into Spring.
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
          <ActiveSemesterCard
            semester={activeSemester}
            onClose={() => void handleClose()}
            closing={closing}
            onMessage={setMessage}
            onUpdated={next => {
              setSemesters(prev => prev.map(s => (s.id === next.id ? next : s)))
            }}
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
                  className={inputClass}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-text">Start date</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className={inputClass}
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-text">End date</span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className={inputClass}
                  required
                />
              </label>

              {previewYearName && (
                <div className="rounded-2xl border border-home-border bg-bg px-4 py-3 text-sm sm:col-span-2">
                  <p>
                    School year:{' '}
                    <span className="font-semibold text-text">{previewYearName}</span>
                    <span className="text-subtitle"> (from start date)</span>
                  </p>
                  {willCreateJts ? (
                    <p className="mt-1 text-subtitle">
                      New school year — unless you customize below, <strong className="font-medium text-text">JT 1–JT 6</strong> placeholders
                      with random colors will be created. Edit names and colors later after themes are decided.
                    </p>
                  ) : (
                    <p className="mt-1 text-subtitle">
                      This school year already has Jiatings — they will carry over. No new placeholders will be created.
                    </p>
                  )}
                </div>
              )}

              {willCreateJts && (
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => {
                      setCustomizeOpen(open => {
                        if (!open) setCustomJts(defaultCustomizeRows())
                        return !open
                      })
                    }}
                  >
                    {customizeOpen ? 'Hide Jiating customize' : 'Customize Jiatings (optional)'}
                  </button>
                  {customizeOpen && (
                    <div className="mt-3 grid gap-2">
                      {customJts.map((jt, index) => (
                        <div key={index} className="flex flex-wrap items-end gap-2">
                          <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm">
                            <span className="font-medium text-text">Name</span>
                            <input
                              className={inputClass}
                              value={jt.name}
                              onChange={e => {
                                const value = e.target.value
                                setCustomJts(rows =>
                                  rows.map((row, i) => (i === index ? { ...row, name: value } : row)),
                                )
                              }}
                              required
                            />
                          </label>
                          <ColorPickerField
                            value={jt.color}
                            onChange={color => {
                              setCustomJts(rows =>
                                rows.map((row, i) => (i === index ? { ...row, color } : row)),
                              )
                            }}
                          />
                          <button
                            type="button"
                            className={btnSecondary}
                            disabled={customJts.length <= 1}
                            onClick={() => setCustomJts(rows => rows.filter((_, i) => i !== index))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() =>
                          setCustomJts(rows => [...rows, { name: `JT ${rows.length + 1}`, color: randomColor() }])
                        }
                      >
                        Add another
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="sm:col-span-2">
                <button type="submit" disabled={starting} className={btnPrimary}>
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
                <PastSemesterCard key={semester.id} semester={semester} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
