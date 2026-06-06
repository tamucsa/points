'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

interface PendingMember {
  id: string
  full_name: string
  preferred_name: string | null
  email: string
  graduation_year: number | null
  created_at: string
}

interface JTFamily {
  id: string
  name: string
}

interface Props {
  pending: PendingMember[]
  jtFamilies: JTFamily[]
}

interface CSVRow {
  'Full Name': string
  'Preferred Name': string
  'TAMU Email': string
  'Phone': string
  'Graduation Year': string
}

interface ImportResult {
  added: number
  skipped: number
  errors: string[]
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

export default function AdminMembersClient({ pending: initialPending, jtFamilies }: Props) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [pending, setPending] = useState(initialPending)
  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [tab, setTab] = useState<'pending' | 'import'>('pending')

  const assignJT = async (memberId: string) => {
    const jtFamilyId = assignments[memberId]
    if (!jtFamilyId) return

    setSaving(memberId)

    await supabase
      .from('members')
      .update({ jt_family_id: jtFamilyId, status: 'active' })
      .eq('id', memberId)

    setPending(p => p.filter(m => m.id !== memberId))
    setSaving(null)
  }

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)

    file.text().then(async (text) => {
      const summary: ImportResult = { added: 0, skipped: 0, errors: [] }
      const rows = parseCSV(text)

      for (const row of rows) {
        const email = row['TAMU Email']?.trim().toLowerCase()

        if (!email?.endsWith('@tamu.edu')) {
          summary.errors.push(`${email} — not a @tamu.edu address`)
          continue
        }

        const { data: existing } = await supabase
          .from('members')
          .select('id')
          .eq('email', email)
          .single()

        if (existing) {
          summary.skipped++
          continue
        }

        const { error } = await supabase.from('members').insert({
          email,
          full_name:       row['Full Name']?.trim(),
          preferred_name:  row['Preferred Name']?.trim() || null,
          phone:           row['Phone']?.trim() || null,
          graduation_year: parseInt(row['Graduation Year']) || null,
          status:          'pending_jt',
          role:            'member',
        })

        if (error) {
          summary.errors.push(`${email} — ${error.message}`)
        } else {
          summary.added++
        }

      }

      setImportResult(summary)
      setImporting(false)
    }).catch(() => {
      setImporting(false)
    })
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-text">Member Admin</h1>
        <div className="mt-1 text-sm text-subtitle">
          Admin only
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 inline-flex rounded-2xl border border-home-border bg-white p-1 shadow-sm">
        {(['pending', 'import'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${tab === t ? 'bg-primary text-white shadow-sm' : 'text-subtitle hover:bg-bg hover:text-text'}`}
          >
            {t === 'pending' ? `Pending JT (${pending.length})` : 'CSV Import'}
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
          {pending.map((m, i) => (
            <div key={m.id} className="flex items-center gap-4 border-b border-home-border px-5 py-4 last:border-b-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
                {(m.preferred_name || m.full_name)[0]}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-text">
                  {m.preferred_name || m.full_name}
                </div>
                <div className="text-xs text-subtitle">{m.email}</div>
                {m.graduation_year && (
                  <div className="text-xs text-subtitle/80">Class of {m.graduation_year}</div>
                )}
              </div>
              <select
                value={assignments[m.id] ?? ''}
                onChange={e => setAssignments(a => ({ ...a, [m.id]: e.target.value }))}
                className="rounded-xl border border-home-border bg-white px-3 py-2 text-sm text-text shadow-sm"
              >
                <option value="">Assign JT…</option>
                {jtFamilies.map(jt => (
                  <option key={jt.id} value={jt.id}>{jt.name}</option>
                ))}
              </select>
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

      {/* Import tab */}
      {tab === 'import' && (
        <div className="rounded-4xl border border-home-border bg-white p-7 shadow-sm">
          <div className="mb-2 text-base font-semibold text-text">
            Import from Google Form CSV
          </div>
          <div className="mb-5 text-sm leading-6 text-subtitle">
            Export responses from Google Forms as a CSV file. The form should collect:
            Full Name, Preferred Name, TAMU Email, Graduation Year, and Phone (optional).
          </div>

          <input
            type="file"
            accept=".csv"
            onChange={handleCSV}
            disabled={importing}
            className="mb-5 block text-sm text-subtitle"
          />

          {importing && (
            <div className="text-sm text-subtitle">Importing…</div>
          )}

          {importResult && (
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                ✅ {importResult.added} members added
              </div>
              {importResult.skipped > 0 && (
                <div className="rounded-2xl border border-home-border bg-bg p-3 text-sm text-subtitle">
                  ⏭️ {importResult.skipped} already existed, skipped
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