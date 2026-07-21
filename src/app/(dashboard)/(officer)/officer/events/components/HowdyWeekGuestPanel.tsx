'use client'

import { useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import {
  clearEventGuests,
  matchGuestRow,
  replaceHowdyWeekGuestsCsv,
  type EventGuestRow,
} from '@/app/actions/guests'
import { inputClassName, labelClassName } from '@/utils/constants'
import { splitCsvLine } from '@/utils/csv'

interface MatchMember {
  id: string
  full_name: string
  email: string
}

interface Props {
  eventId: string
  initialRows: EventGuestRow[]
  matchMembers: MatchMember[]
  btnPrimaryClassName: string
  btnSecondaryClassName: string
}

function parseHowdyWeekCsv(
  text: string,
): { fullName: string; email: string; graduationYear: number }[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase())
  const emailIdx = headers.findIndex(h => h.includes('email'))
  const nameIdx = headers.findIndex(h => h.includes('name'))
  const yearIdx = headers.findIndex(
    h =>
      h.includes('year') ||
      h.includes('class') ||
      h === 'grad' ||
      h.includes('graduation'),
  )
  const hasHeader = emailIdx >= 0 || nameIdx >= 0 || yearIdx >= 0
  const start = hasHeader ? 1 : 0

  return lines.slice(start).map(line => {
    const values = splitCsvLine(line)
    let fullName = ''
    let email = ''
    let yearRaw = ''
    if (hasHeader) {
      fullName = nameIdx >= 0 ? (values[nameIdx] ?? '') : (values[0] ?? '')
      email =
        emailIdx >= 0 ? (values[emailIdx] ?? '') : (values[1] ?? values[0] ?? '')
      yearRaw = yearIdx >= 0 ? (values[yearIdx] ?? '') : (values[2] ?? '')
    } else {
      fullName = values[0] ?? ''
      email = values[1] ?? ''
      yearRaw = values[2] ?? ''
    }
    const graduationYear = Number.parseInt(yearRaw.replace(/[^0-9]/g, ''), 10)
    return {
      fullName,
      email,
      graduationYear: Number.isFinite(graduationYear) ? graduationYear : NaN,
    }
  })
}

export default function HowdyWeekGuestPanel({
  eventId,
  initialRows,
  matchMembers,
  btnPrimaryClassName,
  btnSecondaryClassName,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState(initialRows)
  const [uploading, setUploading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [matchDraft, setMatchDraft] = useState<Record<string, string>>({})

  const hasUpload = rows.length > 0
  const unmatched = useMemo(() => rows.filter(r => !r.member_id), [rows])
  const matchedCount = rows.filter(r => r.member_id).length

  const handleFile = async (file: File | null) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage({ type: 'error', text: 'Please upload a .csv file.' })
      return
    }

    setSelectedFile(file)
    setMessage(null)

    try {
      const text = await file.text()
      const parsed = parseHowdyWeekCsv(text)

      if (parsed.length === 0) {
        if (!hasUpload) {
          setMessage({
            type: 'error',
            text: 'CSV has no data rows to import.',
          })
          return
        }
        const clearConfirm = window.confirm(
          'This CSV has no data rows. Clear all Howdy Week guests for this event?',
        )
        if (!clearConfirm) return
        const step2 = window.confirm(
          'Confirm clear: this removes the guest list and cannot be undone.',
        )
        if (!step2) return

        setUploading(true)
        const clearResult = await clearEventGuests(eventId)
        if (!clearResult.success) {
          setMessage({
            type: 'error',
            text: clearResult.error ?? 'Failed to clear guests.',
          })
          return
        }
        setMessage({ type: 'success', text: 'Guest list cleared.' })
        window.location.reload()
        return
      }

      if (hasUpload) {
        const step1 = window.confirm(
          'Replace the current Howdy Week guest list for this event?',
        )
        if (!step1) return
        const step2 = window.confirm(
          'Confirm replace: people not on the new CSV will be removed from this event.',
        )
        if (!step2) return
      }

      setUploading(true)
      const result = await replaceHowdyWeekGuestsCsv(eventId, parsed)

      if (!result.success) {
        setMessage({
          type: 'error',
          text: result.errors[0] ?? 'Failed to upload CSV.',
        })
        return
      }

      if ('cleared' in result && result.cleared) {
        setMessage({ type: 'success', text: 'Guest list cleared.' })
        window.location.reload()
        return
      }

      const skippedNote =
        result.skipped > 0
          ? ` ${result.skipped} row(s) skipped.`
          : ''
      const warningNote = result.errors.length
        ? ` ${result.errors.length} warning(s): ${result.errors.slice(0, 3).join(' ')}${
            result.errors.length > 3 ? '…' : ''
          }`
        : ''
      setMessage({
        type: 'success',
        text: `Guest list updated: ${result.matched} linked to members, ${result.unmatched} unmatched.${skippedNote}${warningNote}`,
      })
      window.location.reload()
    } catch {
      setMessage({ type: 'error', text: 'Failed to read the CSV file.' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleClear = async () => {
    if (!hasUpload) return
    const step1 = window.confirm(
      'Clear all Howdy Week guests for this event?',
    )
    if (!step1) return
    const step2 = window.confirm('Confirm clear: this cannot be undone.')
    if (!step2) return

    setClearing(true)
    setMessage(null)
    const result = await clearEventGuests(eventId)
    setClearing(false)
    if (!result.success) {
      setMessage({
        type: 'error',
        text: result.error ?? 'Failed to clear guests.',
      })
      return
    }
    setMessage({ type: 'success', text: 'Guest list cleared.' })
    window.location.reload()
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!uploading) setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragActive(false)
  }

  const handleMatch = async (guestId: string) => {
    const memberId = matchDraft[guestId]
    if (!memberId) return
    setBusyId(guestId)
    setMessage(null)
    const result = await matchGuestRow(guestId, memberId)
    setBusyId(null)
    if (!result.success) {
      setMessage({ type: 'error', text: result.error ?? 'Failed to match.' })
      return
    }
    const member = matchMembers.find(m => m.id === memberId)
    setRows(prev =>
      prev.map(r =>
        r.id === guestId
          ? {
              ...r,
              member_id: memberId,
              member_name: member?.full_name ?? null,
              email: member?.email.toLowerCase() ?? r.email,
              full_name: member?.full_name ?? r.full_name,
            }
          : r,
      ),
    )
    setMatchDraft(d => {
      const next = { ...d }
      delete next[guestId]
      return next
    })
  }

  return (
    <div className="mt-5 space-y-3 rounded-2xl border border-home-border bg-bg p-4">
      <div>
        <div className="text-sm font-semibold text-text">Howdy Week guest CSV</div>
        <p className="mt-1 text-xs leading-5 text-subtitle">
          Upload Google Form responses from the event. Columns:{' '}
          <span className="font-medium text-text">Name</span>,{' '}
          <span className="font-medium text-text">Email</span> (@tamu.edu),{' '}
          <span className="font-medium text-text">Year</span> (graduation year
          number). Email is the match key. Re-upload replaces the guest list.
          Linked members appear under Attendance at 0 points.
        </p>
      </div>

      {hasUpload && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-subtitle">
            Current list: {matchedCount} linked · {unmatched.length} unmatched
          </p>
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={uploading || clearing}
            className={btnSecondaryClassName}
          >
            {clearing ? 'Clearing…' : 'Clear list'}
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        id="howdy-week-csv-upload"
        disabled={uploading}
        className="sr-only"
        onChange={handleFileInput}
      />

      <div
        role="button"
        tabIndex={uploading ? -1 : 0}
        aria-label="Upload Howdy Week guest CSV"
        aria-disabled={uploading}
        onKeyDown={e => {
          if (uploading) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            fileRef.current?.click()
          }
        }}
        onClick={() => !uploading && fileRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
          uploading
            ? 'cursor-not-allowed border-home-border bg-surface opacity-70'
            : dragActive
              ? 'border-primary bg-primary/5'
              : 'border-home-border bg-surface hover:border-primary/40'
        }`}
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <FileText className="size-6 text-primary" aria-hidden />
        </div>
        {uploading ? (
          <>
            <p className="text-sm font-medium text-text">Uploading…</p>
            {selectedFile && (
              <p className="mt-1 text-xs text-subtitle">{selectedFile.name}</p>
            )}
          </>
        ) : selectedFile ? (
          <>
            <p className="text-sm font-medium text-text">{selectedFile.name}</p>
            <p className="mt-1 text-xs text-subtitle">
              Drop another file or click to {hasUpload ? 'replace' : 'upload'}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-text">
              Drag and drop your CSV here
            </p>
            <p className="mt-1 text-xs text-subtitle">
              or <span className="font-medium text-primary">browse files</span>
              {hasUpload ? ' to replace' : ''}
            </p>
          </>
        )}
      </div>

      {message && (
        <p
          className={`text-sm ${
            message.type === 'success' ? 'text-green-700' : 'text-red-600'
          }`}
        >
          {message.text}
        </p>
      )}

      {unmatched.length > 0 && (
        <div className="space-y-2 border-t border-home-border/80 pt-3">
          <div className="text-sm font-semibold text-text">Unmatched emails</div>
          <p className="text-xs text-subtitle">
            Match to a member if they already registered (e.g. email typo on the
            form).
          </p>
          <ul className="space-y-2">
            {unmatched.map(row => (
              <li
                key={row.id}
                className="rounded-xl border border-home-border bg-surface px-3 py-2.5"
              >
                <div className="text-sm font-medium text-text">
                  {row.full_name || '—'}
                  {row.graduation_year != null && (
                    <span className="ml-2 text-xs font-normal text-subtitle">
                      Class of {row.graduation_year}
                    </span>
                  )}
                </div>
                <div className="text-xs text-subtitle">{row.email}</div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    className={`${inputClassName} sm:flex-1`}
                    value={matchDraft[row.id] ?? ''}
                    onChange={e =>
                      setMatchDraft(d => ({ ...d, [row.id]: e.target.value }))
                    }
                    aria-label={`Match ${row.email}`}
                  >
                    <option value="">Match to member…</option>
                    {matchMembers.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.email})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={btnPrimaryClassName}
                    disabled={!matchDraft[row.id] || busyId === row.id}
                    onClick={() => void handleMatch(row.id)}
                  >
                    {busyId === row.id ? '…' : 'Match'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {matchedCount > 0 && (
        <div className="space-y-1 border-t border-home-border/80 pt-3">
          <div className="text-sm font-semibold text-text">Linked to members</div>
          <ul className="text-xs text-subtitle">
            {rows
              .filter(r => r.member_id)
              .map(g => (
                <li key={g.id}>
                  {g.member_name || g.full_name || '—'} · {g.email}
                  {g.graduation_year != null
                    ? ` · Class of ${g.graduation_year}`
                    : ''}
                </li>
              ))}
          </ul>
        </div>
      )}

      <p className={`text-[11px] ${labelClassName}`}>
        Non-@tamu.edu rows are skipped. Matching links the guest and records
        attendance at 0 points — points can be awarded later.
      </p>
    </div>
  )
}
