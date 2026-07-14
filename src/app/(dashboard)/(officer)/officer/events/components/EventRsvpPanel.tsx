'use client'

import { useMemo, useRef, useState } from 'react'
import { FileText } from 'lucide-react'
import {
  dismissEventRsvpAsGuest,
  matchEventRsvpRow,
  replaceEventRsvpCsv,
  type EventRsvpRow,
} from '@/app/actions/rsvp'
import { inputClassName, labelClassName } from '@/utils/constants'

interface MatchMember {
  id: string
  full_name: string
  email: string
}

interface Props {
  eventId: string
  rsvpDeadline: string | null
  initialRows: EventRsvpRow[]
  matchMembers: MatchMember[]
  btnPrimaryClassName: string
  btnSecondaryClassName: string
}

function parseRsvpCsv(text: string): { fullName: string; email: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const split = (line: string) =>
    line.split(',').map(value => value.trim().replace(/^"|"$/g, ''))

  const headers = split(lines[0]).map(h => h.toLowerCase())
  const emailIdx = headers.findIndex(h => h.includes('email'))
  const nameIdx = headers.findIndex(h => h.includes('name'))

  // Headerless fallback: col0=name, col1=email
  const hasHeader = emailIdx >= 0 || nameIdx >= 0
  const start = hasHeader ? 1 : 0

  return lines.slice(start).map(line => {
    const values = split(line)
    if (hasHeader) {
      return {
        fullName: nameIdx >= 0 ? (values[nameIdx] ?? '') : (values[0] ?? ''),
        email: emailIdx >= 0 ? (values[emailIdx] ?? '') : (values[1] ?? values[0] ?? ''),
      }
    }
    return {
      fullName: values[0] ?? '',
      email: values[1] ?? values[0] ?? '',
    }
  })
}

export default function EventRsvpPanel({
  eventId,
  rsvpDeadline,
  initialRows,
  matchMembers,
  btnPrimaryClassName,
  btnSecondaryClassName,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState(initialRows)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [matchDraft, setMatchDraft] = useState<Record<string, string>>({})

  const deadlinePassed = Boolean(rsvpDeadline && new Date(rsvpDeadline) <= new Date())
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

    if (hasUpload) {
      const step1 = window.confirm(
        'Replace the current RSVP list for this event? Matched tags, unmatched rows, and guest dismissals will all be cleared.',
      )
      if (!step1) return
      const step2 = window.confirm(
        'Confirm replace: this cannot be undone. Upload the new CSV now?',
      )
      if (!step2) return
    }

    setSelectedFile(file)
    setUploading(true)
    setMessage(null)

    try {
      const text = await file.text()
      const parsed = parseRsvpCsv(text)
      const result = await replaceEventRsvpCsv(eventId, parsed)

      if (!result.success) {
        setMessage({
          type: 'error',
          text: result.errors[0] ?? 'Failed to upload RSVP CSV.',
        })
        return
      }

      setMessage({
        type: 'success',
        text: `RSVP list updated: ${result.matched} matched, ${result.unmatched} unmatched.${
          result.errors.length ? ` ${result.errors.length} row warning(s).` : ''
        }`,
      })
      window.location.reload()
    } catch {
      setMessage({ type: 'error', text: 'Failed to read the CSV file.' })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
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

  const handleMatch = async (rsvpId: string) => {
    const memberId = matchDraft[rsvpId]
    if (!memberId) return
    setBusyId(rsvpId)
    setMessage(null)
    const result = await matchEventRsvpRow(rsvpId, memberId)
    setBusyId(null)
    if (!result.success) {
      setMessage({ type: 'error', text: result.error ?? 'Failed to match.' })
      return
    }
    const member = matchMembers.find(m => m.id === memberId)
    setRows(prev =>
      prev.map(r =>
        r.id === rsvpId
          ? {
              ...r,
              member_id: memberId,
              is_guest: false,
              member_name: member?.full_name ?? null,
              email: member?.email.toLowerCase() ?? r.email,
              full_name: member?.full_name ?? r.full_name,
            }
          : r,
      ),
    )
    setMatchDraft(d => {
      const next = { ...d }
      delete next[rsvpId]
      return next
    })
  }

  const handleGuest = async (rsvpId: string) => {
    if (!window.confirm('Mark this row as a guest (not a CSA member)?')) return
    setBusyId(rsvpId)
    setMessage(null)
    const result = await dismissEventRsvpAsGuest(rsvpId)
    setBusyId(null)
    if (!result.success) {
      setMessage({ type: 'error', text: result.error ?? 'Failed to mark guest.' })
      return
    }
    setRows(prev =>
      prev.map(r => (r.id === rsvpId ? { ...r, member_id: null, is_guest: true } : r)),
    )
  }

  return (
    <div className="mt-5 space-y-3 rounded-2xl border border-home-border bg-bg p-4">
      <div>
        <div className="text-sm font-semibold text-text">RSVP roster CSV</div>
        <p className="mt-1 text-xs leading-5 text-subtitle">
          Optional tags for check-in only — does not block or filter who can be checked in.
          Columns: <span className="font-medium text-text">Name</span>,{' '}
          <span className="font-medium text-text">Email</span> (email is the match key). Re-upload replaces the list.
        </p>
      </div>

      {deadlinePassed && !hasUpload && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
          RSVP deadline has passed. Upload the form responses CSV to tag members as RSVPed on the check-in page.
        </div>
      )}

      {hasUpload && (
        <p className="text-xs text-subtitle">
          Current list: {matchedCount} matched · {unmatched.length} unmatched · {guests.length} guest
          {guests.length === 1 ? '' : 's'}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        id="rsvp-csv-upload"
        disabled={uploading}
        className="sr-only"
        onChange={handleFileInput}
      />

      <div
        role="button"
        tabIndex={uploading ? -1 : 0}
        aria-label="Upload RSVP CSV file"
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
              Drag and drop your RSVP CSV here
            </p>
            <p className="mt-1 text-xs text-subtitle">
              or <span className="font-medium text-primary">browse files</span>
              {hasUpload ? ' to replace' : ''}
            </p>
          </>
        )}
      </div>

      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
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
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={`text-[11px] ${labelClassName}`}>
        Check-in stays available whether or not a CSV is uploaded. Tags appear on check-in only after an upload.
      </p>
    </div>
  )
}
