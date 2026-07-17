'use client'

import { useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import {
  clearEventImport,
  dismissImportRowAsGuest,
  matchImportRow,
  replaceManualPointsCsv,
  replaceMixerAttendanceCsv,
  type EventImportRow,
} from '@/app/actions/imports'
import { inputClassName, labelClassName } from '@/utils/constants'
import { splitCsvLine } from '@/utils/csv'

interface MatchMember {
  id: string
  full_name: string
  email: string
}

interface Props {
  eventId: string
  mode: 'mixer_attendance' | 'manual_points'
  initialRows: EventImportRow[]
  matchMembers: MatchMember[]
  btnPrimaryClassName: string
  btnSecondaryClassName: string
}

function parseMixerCsv(
  text: string,
): { fullName: string; email: string; organization: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase())
  const emailIdx = headers.findIndex(h => h.includes('email'))
  const nameIdx = headers.findIndex(h => h.includes('name'))
  const orgIdx = headers.findIndex(
    h => h.includes('organization') || h.includes('org'),
  )
  const hasHeader = emailIdx >= 0 || nameIdx >= 0 || orgIdx >= 0
  const start = hasHeader ? 1 : 0

  return lines.slice(start).map(line => {
    const values = splitCsvLine(line)
    if (hasHeader) {
      return {
        fullName: nameIdx >= 0 ? (values[nameIdx] ?? '') : (values[0] ?? ''),
        email:
          emailIdx >= 0
            ? (values[emailIdx] ?? '')
            : (values[1] ?? values[0] ?? ''),
        organization:
          orgIdx >= 0 ? (values[orgIdx] ?? '') : (values[2] ?? ''),
      }
    }
    return {
      fullName: values[0] ?? '',
      email: values[1] ?? '',
      organization: values[2] ?? '',
    }
  })
}

function parseManualPointsCsv(
  text: string,
): { fullName: string; email: string; points: number }[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase())
  const emailIdx = headers.findIndex(h => h.includes('email'))
  const nameIdx = headers.findIndex(h => h.includes('name'))
  const pointsIdx = headers.findIndex(
    h => h.includes('point') || h === 'pts' || h === 'amount',
  )
  const hasHeader = emailIdx >= 0 || nameIdx >= 0 || pointsIdx >= 0
  const start = hasHeader ? 1 : 0

  return lines.slice(start).map(line => {
    const values = splitCsvLine(line)
    let fullName = ''
    let email = ''
    let pointsRaw = ''
    if (hasHeader) {
      fullName = nameIdx >= 0 ? (values[nameIdx] ?? '') : (values[0] ?? '')
      email =
        emailIdx >= 0 ? (values[emailIdx] ?? '') : (values[1] ?? values[0] ?? '')
      pointsRaw =
        pointsIdx >= 0 ? (values[pointsIdx] ?? '') : (values[2] ?? '')
    } else {
      fullName = values[0] ?? ''
      email = values[1] ?? ''
      pointsRaw = values[2] ?? ''
    }
    return {
      fullName,
      email,
      points: Number(pointsRaw),
    }
  })
}

export default function EventImportPanel({
  eventId,
  mode,
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

  const isMixer = mode === 'mixer_attendance'
  const hasUpload = rows.length > 0

  const unmatched = useMemo(
    () => rows.filter(r => !r.member_id && !r.is_guest),
    [rows],
  )
  const guests = useMemo(() => rows.filter(r => r.is_guest), [rows])
  const matchedCount = rows.filter(r => r.member_id && !r.is_guest).length

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

      const confirmEmptyClear = async () => {
        const clearConfirm = window.confirm(
          hasUpload
            ? 'This CSV has no data rows. Clear all imported rows and attendance for this event?'
            : 'This CSV has no data rows. Nothing to import.',
        )
        if (!hasUpload || !clearConfirm) {
          if (!hasUpload) {
            setMessage({
              type: 'error',
              text: 'CSV has no data rows to import.',
            })
          }
          return false
        }
        const step2 = window.confirm(
          'Confirm clear: this removes all imported check-ins/points for this event and cannot be undone.',
        )
        if (!step2) return false

        setUploading(true)
        const clearResult = await clearEventImport(eventId)
        if (!clearResult.success) {
          setMessage({
            type: 'error',
            text: clearResult.error ?? 'Failed to clear import.',
          })
          return false
        }
        setMessage({ type: 'success', text: 'Import cleared.' })
        window.location.reload()
        return true
      }

      const confirmReplace = () => {
        if (!hasUpload) return true
        const step1 = window.confirm(
          isMixer
            ? 'Replace the current CSV attendance for this event? Matched check-ins and unmatched rows will be updated.'
            : 'Replace the current manual points for this event? Awarded points and unmatched rows will be updated.',
        )
        if (!step1) return false
        return window.confirm(
          'Confirm replace: people not on the new CSV will lose attendance/points for this event.',
        )
      }

      let result: Awaited<ReturnType<typeof replaceMixerAttendanceCsv>>
      if (isMixer) {
        const parsed = parseMixerCsv(text)
        if (parsed.length === 0) {
          await confirmEmptyClear()
          return
        }
        if (!confirmReplace()) return
        setUploading(true)
        result = await replaceMixerAttendanceCsv(eventId, parsed)
      } else {
        const parsed = parseManualPointsCsv(text)
        if (parsed.length === 0) {
          await confirmEmptyClear()
          return
        }
        if (!confirmReplace()) return
        setUploading(true)
        result = await replaceManualPointsCsv(eventId, parsed)
      }

      if (!result.success) {
        setMessage({
          type: 'error',
          text: result.errors[0] ?? 'Failed to upload CSV.',
        })
        return
      }

      if ('cleared' in result && result.cleared) {
        setMessage({ type: 'success', text: 'Import cleared.' })
        window.location.reload()
        return
      }

      const skippedNote =
        isMixer && result.skipped > 0
          ? ` ${result.skipped} non-CSA row(s) skipped.`
          : ''
      const warningNote = result.errors.length
        ? ` ${result.errors.length} warning(s): ${result.errors.slice(0, 3).join(' ')}${
            result.errors.length > 3 ? '…' : ''
          }`
        : ''
      setMessage({
        type: 'success',
        text: `Import updated: ${result.matched} matched, ${result.unmatched} unmatched.${skippedNote}${warningNote}`,
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
      isMixer
        ? 'Clear all CSV attendance and unmatched rows for this event?'
        : 'Clear all manual points and unmatched rows for this event?',
    )
    if (!step1) return
    const step2 = window.confirm(
      'Confirm clear: this cannot be undone.',
    )
    if (!step2) return

    setClearing(true)
    setMessage(null)
    const result = await clearEventImport(eventId)
    setClearing(false)
    if (!result.success) {
      setMessage({
        type: 'error',
        text: result.error ?? 'Failed to clear import.',
      })
      return
    }
    setMessage({ type: 'success', text: 'Import cleared.' })
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

  const handleMatch = async (importId: string) => {
    const memberId = matchDraft[importId]
    if (!memberId) return
    setBusyId(importId)
    setMessage(null)
    const result = await matchImportRow(importId, memberId)
    setBusyId(null)
    if (!result.success) {
      setMessage({ type: 'error', text: result.error ?? 'Failed to match.' })
      return
    }
    const member = matchMembers.find(m => m.id === memberId)
    setRows(prev =>
      prev.map(r =>
        r.id === importId
          ? {
              ...r,
              member_id: memberId,
              is_guest: false,
              applied: true,
              member_name: member?.full_name ?? null,
              email: member?.email.toLowerCase() ?? r.email,
              full_name: member?.full_name ?? r.full_name,
            }
          : r,
      ),
    )
    setMatchDraft(d => {
      const next = { ...d }
      delete next[importId]
      return next
    })
  }

  const handleGuest = async (importId: string) => {
    if (!window.confirm('Mark this row as a guest (not a CSA member)?')) return
    setBusyId(importId)
    setMessage(null)
    const result = await dismissImportRowAsGuest(importId)
    setBusyId(null)
    if (!result.success) {
      setMessage({
        type: 'error',
        text: result.error ?? 'Failed to mark guest.',
      })
      return
    }
    setRows(prev =>
      prev.map(r =>
        r.id === importId
          ? { ...r, member_id: null, is_guest: true, applied: false }
          : r,
      ),
    )
  }

  return (
    <div className="mt-5 space-y-3 rounded-2xl border border-home-border bg-bg p-4">
      <div>
        <div className="text-sm font-semibold text-text">
          {isMixer ? 'Attendance CSV' : 'Manual points CSV'}
        </div>
        <p className="mt-1 text-xs leading-5 text-subtitle">
          {isMixer ? (
            <>
              Upload the shared Google Form responses. Only rows whose{' '}
              <span className="font-medium text-text">Organization</span>
              {' '}contains &ldquo;CSA&rdquo; are kept. Columns:{' '}
              <span className="font-medium text-text">Name</span>,{' '}
              <span className="font-medium text-text">Email</span>,{' '}
              <span className="font-medium text-text">Organization</span>. Email is
              the match key. Re-upload replaces the list and attendance.
            </>
          ) : (
            <>
              Upload name, email, and points for monetary philanthropy awards.
              Columns: <span className="font-medium text-text">Name</span>,{' '}
              <span className="font-medium text-text">Email</span>,{' '}
              <span className="font-medium text-text">Points</span>. Re-upload
              replaces awarded points for this event.
            </>
          )}
        </p>
      </div>

      {hasUpload && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-subtitle">
            Current list: {matchedCount} matched · {unmatched.length} unmatched ·{' '}
            {guests.length} guest{guests.length === 1 ? '' : 's'}
          </p>
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={uploading || clearing}
            className={btnSecondaryClassName}
          >
            {clearing ? 'Clearing…' : 'Clear import'}
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        id={`${mode}-csv-upload`}
        disabled={uploading}
        className="sr-only"
        onChange={handleFileInput}
      />

      <div
        role="button"
        tabIndex={uploading ? -1 : 0}
        aria-label={isMixer ? 'Upload attendance CSV' : 'Upload manual points CSV'}
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
            ? 'cursor-not-allowed border-home-border bg-white opacity-70'
            : dragActive
              ? 'border-primary bg-primary/5'
              : 'border-home-border bg-white hover:border-primary/40'
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
            Match to a member (e.g. typo on the form) or mark as guest.
          </p>
          <ul className="space-y-2">
            {unmatched.map(row => (
              <li
                key={row.id}
                className="rounded-xl border border-home-border bg-white px-3 py-2.5"
              >
                <div className="text-sm font-medium text-text">
                  {row.full_name || '—'}
                  {!isMixer && row.points != null ? (
                    <span className="ml-2 text-xs font-semibold text-primary">
                      {row.points} pt{row.points === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-subtitle">{row.email}</div>
                {row.organization && (
                  <div className="text-xs text-subtitle">{row.organization}</div>
                )}
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={btnPrimaryClassName}
                      disabled={!matchDraft[row.id] || busyId === row.id}
                      onClick={() => void handleMatch(row.id)}
                    >
                      {busyId === row.id ? '…' : 'Match'}
                    </button>
                    <button
                      type="button"
                      className={btnSecondaryClassName}
                      disabled={busyId === row.id}
                      onClick={() => void handleGuest(row.id)}
                    >
                      Guest
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {guests.length > 0 && (
        <div className="space-y-1 border-t border-home-border/80 pt-3">
          <div className="text-sm font-semibold text-text">Guests</div>
          <ul className="text-xs text-subtitle">
            {guests.map(g => (
              <li key={g.id}>
                {g.full_name || '—'} · {g.email}
                {g.organization ? ` · ${g.organization}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={`text-[11px] ${labelClassName}`}>
        {isMixer
          ? 'Non-CSA organization rows are ignored automatically. Matched CSA members receive 3 points.'
          : 'Each matched row awards the points listed in the CSV under Philanthropy (CSA bucket).'}
      </p>
    </div>
  )
}
