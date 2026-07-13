'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, ChevronDown } from 'lucide-react'
import { activateMember, importMembers, type ImportMode, type JtChange } from '@/app/actions/members'
import AdminRolesPanel, {
  type RoleMember,
} from '@/app/(dashboard)/(admin)/admin/members/components/AdminRolesPanel'
import MemberAvatar from '@/app/components/MemberAvatar'
import type { MemberRole } from '@/utils/members'

interface PendingMember {
  id: string
  full_name: string
  email: string
  graduation_year: number | null
  created_at: string
}

interface JTFamily {
  id: string
  name: string
}

type AdminTab = 'pending' | 'import' | 'roles'

interface Props {
  pending: PendingMember[]
  jtFamilies: JTFamily[]
  initialTab: AdminTab
  currentAdminId: string
  roleMembers: RoleMember[]
  rolePage: number
  roleTotalPages: number
  roleTotalCount: number
  roleQuery: string
  roleFilter: 'all' | MemberRole
}

interface CSVRow {
  'Full Name': string
  'TAMU Email': string
  'Jiating': string
  'Phone': string
  'Class': string
}

interface ImportResult {
  added: number
  updated: number
  unchanged: number
  jtChanged: number
  jtChanges: JtChange[]
  errors: string[]
}

function buildMemberImportTemplate(jtFamilies: JTFamily[]) {
  const jt1 = jtFamilies[0]?.name ?? 'Jiating A'
  const jt2 = jtFamilies[1]?.name ?? jt1
  return `Full Name,TAMU Email,Jiating,Phone,Class
John Smith,john.smith@tamu.edu,${jt1},(979) 555-0101,2027
Jane Doe,jane.doe@tamu.edu,${jt2},(979) 555-0102,2028
Alex Chen,alex.chen@tamu.edu,${jt1},979-555-0199,2026`
}

function downloadMemberImportTemplate(jtFamilies: JTFamily[]) {
  const blob = new Blob([buildMemberImportTemplate(jtFamilies)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'csa-member-import-template.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function parseCSV(text: string): CSVRow[] {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const headers = lines[0].split(',').map(header => header.trim().replace(/^"|"$/g, ''))

  return lines.slice(1).map(line => {
    const values = line.split(',').map(value => value.trim().replace(/^"|"$/g, ''))
    const row = {} as CSVRow

    headers.forEach((header, index) => {
      ;(row as unknown as Record<string, string>)[header] = values[index] ?? ''
    })

    return row
  })
}

function tabHref(tab: AdminTab) {
  if (tab === 'pending') return '/admin/members'
  return `/admin/members?tab=${tab}`
}

export default function AdminMembersClient({
  pending: initialPending,
  jtFamilies,
  initialTab,
  currentAdminId,
  roleMembers,
  rolePage,
  roleTotalPages,
  roleTotalCount,
  roleQuery,
  roleFilter,
}: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(initialPending)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importMode, setImportMode] = useState<ImportMode>('full')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const tab = initialTab

  const assignJT = async (memberId: string) => {
    const jtFamilyId = assignments[memberId]
    if (!jtFamilyId) return

    setSaving(memberId)

    const result = await activateMember(memberId, jtFamilyId)
    setSaving(null)

    if (!result.success) return

    setPending(p => p.filter(m => m.id !== memberId))
  }

  const processCsvFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) return

    setSelectedFile(file)
    setImportResult(null)
    setImporting(true)

    try {
      const text = await file.text()
      const rows = parseCSV(text)
      const result = await importMembers(rows.map(row => ({
        fullName: row['Full Name'],
        email: row['TAMU Email'],
        jtFamily: row['Jiating'],
        phone: row['Phone'],
        classYear: row['Class'],
      })), importMode)

      if (result.success) {
        setImportResult({
          added: result.added,
          updated: result.updated,
          unchanged: result.unchanged,
          jtChanged: result.jtChanged,
          jtChanges: result.jtChanges,
          errors: result.errors,
        })
      } else {
        setImportResult({
          added: 0,
          updated: 0,
          unchanged: 0,
          jtChanged: 0,
          jtChanges: [],
          errors: result.errors,
        })
      }
    } catch {
      setImportResult({
        added: 0,
        updated: 0,
        unchanged: 0,
        jtChanged: 0,
        jtChanges: [],
        errors: ['Failed to read the CSV file.'],
      })
    } finally {
      setImporting(false)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void processCsvFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void processCsvFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!importing) setDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragActive(false)
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-text">Member Admin</h1>
        <div className="mt-1 text-sm text-subtitle">
          {pending.length} pending JT assignment{pending.length === 1 ? '' : 's'} · Roles · CSV import
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-2xl border border-home-border bg-white p-1 shadow-sm">
        {([
          { id: 'pending' as const, label: `Pending JT (${pending.length})` },
          { id: 'roles' as const, label: 'Roles' },
          { id: 'import' as const, label: 'CSV Import' },
        ]).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => router.push(tabHref(t.id))}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${tab === t.id ? 'bg-primary text-white shadow-sm' : 'text-subtitle hover:bg-bg hover:text-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === 'pending' && (
        <div className="overflow-hidden rounded-4xl border border-home-border bg-white shadow-sm">
          {pending.length === 0 && (
            <div className="px-8 py-10 text-center text-sm text-subtitle">
              No members pending JT assignment.
            </div>
          )}
          {pending.map(m => (
            <div key={m.id} className="flex items-center gap-4 border-b border-home-border px-5 py-4 last:border-b-0">
              <MemberAvatar name={m.full_name} />
              <div className="flex-1">
                <div className="text-sm font-medium text-text">
                  {m.full_name}
                </div>
                <div className="text-xs text-subtitle">{m.email}</div>
                {m.graduation_year && (
                  <div className="text-xs text-subtitle/80">Class of {m.graduation_year}</div>
                )}
              </div>
              <div className="relative">
                <select
                  value={assignments[m.id] ?? ''}
                  onChange={e => setAssignments(a => ({ ...a, [m.id]: e.target.value }))}
                  className="cursor-pointer appearance-none rounded-xl border border-home-border bg-white py-2 pl-3 pr-10 text-sm text-text shadow-sm"
                >
                  <option value="">Assign JT…</option>
                  {jtFamilies.map(jt => (
                    <option key={jt.id} value={jt.id}>{jt.name}</option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtitle"
                  aria-hidden
                />
              </div>
              <button
                onClick={() => assignJT(m.id)}
                disabled={!assignments[m.id] || saving === m.id}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#9cb8d8]"
              >
                {saving === m.id ? 'Saving…' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'roles' && (
        <AdminRolesPanel
          members={roleMembers}
          currentAdminId={currentAdminId}
          page={rolePage}
          totalPages={roleTotalPages}
          totalCount={roleTotalCount}
          query={roleQuery}
          roleFilter={roleFilter}
        />
      )}

      {/* Import tab */}
      {tab === 'import' && (
        <div className="rounded-4xl border border-home-border bg-white p-7 shadow-sm">
          <div className="mb-2 text-base font-semibold text-text">
            Import from CSV
          </div>

          <div className="mb-4 inline-flex rounded-2xl border border-home-border bg-bg p-1">
            {([
              { id: 'full' as const, label: 'Full roster (fall)' },
              { id: 'spring' as const, label: 'Spring update (partial)' },
            ]).map(option => (
              <button
                key={option.id}
                type="button"
                onClick={() => setImportMode(option.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  importMode === option.id
                    ? 'bg-white text-text shadow-sm'
                    : 'text-subtitle hover:text-text'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="mb-4 text-sm leading-6 text-subtitle">
            {importMode === 'full'
              ? 'Upload the full CSA roster at the start of fall. New members are created; existing emails are updated only where CSV values differ.'
              : 'Upload only changed rows for spring (JT transfers, new members, or profile fixes). Unlisted members are left unchanged.'}
          </p>

          <div className="mb-4 overflow-hidden rounded-2xl border border-home-border bg-bg text-sm">
            <div className="border-b border-home-border px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-subtitle">
              CSV columns
            </div>
            <ul className="divide-y divide-home-border">
              {[
                { name: 'Full Name', required: true, note: 'Complete name as shown in the app' },
                { name: 'TAMU Email', required: true, note: 'Must be a @tamu.edu address' },
                { name: 'Jiating', required: true, note: 'Must match an active Jiating name (see below)' },
                { name: 'Phone', required: true, note: 'Contact phone number' },
                { name: 'Class', required: true, note: 'Graduation year, e.g. 2027' },
              ].map(col => (
                <li key={col.name} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text">{col.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        col.required
                          ? 'bg-primary/10 text-primary'
                          : 'bg-home-border/60 text-subtitle'
                      }`}
                    >
                      {col.required ? 'Required' : 'Optional'}
                    </span>
                  </div>
                  <span className="text-xs text-subtitle sm:text-right">{col.note}</span>
                </li>
              ))}
            </ul>
          </div>

          {jtFamilies.length > 0 && (
            <p className="mb-4 text-xs leading-5 text-subtitle">
              Active Jiatings: {jtFamilies.map(jt => jt.name).join(', ')}
            </p>
          )}

          <button
            type="button"
            onClick={() => downloadMemberImportTemplate(jtFamilies)}
            className="mb-5 inline-flex items-center gap-2 rounded-xl border border-home-border bg-bg px-4 py-2.5 text-sm font-medium text-primary transition hover:border-primary/30 hover:bg-white"
          >
            <span aria-hidden>↓</span>
            Download example CSV
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileInput}
            disabled={importing}
            className="sr-only"
            id="member-csv-upload"
          />

          <div
            role="button"
            tabIndex={importing ? -1 : 0}
            aria-label="Upload member CSV file"
            aria-disabled={importing}
            onKeyDown={e => {
              if (importing) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            onClick={() => !importing && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`mb-5 flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-10 text-center transition ${
              importing
                ? 'cursor-not-allowed border-home-border bg-bg opacity-70'
                : dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-home-border bg-bg hover:border-primary/40 hover:bg-white'
            }`}
          >
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <FileText className="size-6 text-primary" aria-hidden />
            </div>
            {importing ? (
              <>
                <p className="text-sm font-medium text-text">Importing…</p>
                {selectedFile && (
                  <p className="mt-1 text-xs text-subtitle">{selectedFile.name}</p>
                )}
              </>
            ) : selectedFile ? (
              <>
                <p className="text-sm font-medium text-text">{selectedFile.name}</p>
                <p className="mt-1 text-xs text-subtitle">Drop another file or click to replace</p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-text">
                  Drag and drop your CSV here
                </p>
                <p className="mt-1 text-xs text-subtitle">
                  or <span className="font-medium text-primary">browse files</span>
                </p>
              </>
            )}
          </div>

          {importResult && (
            <div className="flex flex-col gap-3">
              {importResult.added > 0 && (
                <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                  ✅ {importResult.added} members added
                </div>
              )}
              {importResult.updated > 0 && (
                <div className="rounded-2xl border border-home-border bg-bg p-3 text-sm text-subtitle">
                  ↻ {importResult.updated} members updated
                </div>
              )}
              {importResult.unchanged > 0 && (
                <div className="rounded-2xl border border-home-border bg-bg p-3 text-sm text-subtitle">
                  — {importResult.unchanged} rows matched with no changes
                </div>
              )}
              {importResult.jtChanged > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <div className="mb-2 font-medium">
                    ↔ {importResult.jtChanged} Jiating transfer{importResult.jtChanged === 1 ? '' : 's'}
                  </div>
                  <ul className="space-y-1 text-xs">
                    {importResult.jtChanges.map(change => (
                      <li key={change.email}>
                        {change.fullName} ({change.email}): {change.fromJt ?? 'none'} → {change.toJt}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {importResult.added === 0 &&
                importResult.updated === 0 &&
                importResult.unchanged === 0 &&
                importResult.errors.length === 0 && (
                <div className="rounded-2xl border border-home-border bg-bg p-3 text-sm text-subtitle">
                  No rows processed.
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                  <div className="mb-2 text-sm text-red-500">
                    ⚠️ {importResult.errors.length} errors
                  </div>
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="text-xs text-red-400">{err}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
