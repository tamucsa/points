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
    <div style={{ padding: 28, maxWidth: 800, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Member Admin</h1>
        <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
          Admin only
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#0f1117', padding: 4, borderRadius: 8, width: 'fit-content' }}>
        {(['pending', 'import'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 16px', borderRadius: 6, border: 'none',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
              background: tab === t ? '#1e2337' : 'transparent',
              color: tab === t ? '#fff' : '#555',
            }}
          >
            {t === 'pending' ? `Pending JT (${pending.length})` : 'CSV Import'}
          </button>
        ))}
      </div>

      {/* Pending tab */}
      {tab === 'pending' && (
        <div style={{
          background: '#161a27', borderRadius: 14,
          border: '1px solid #1e2337', overflow: 'hidden',
        }}>
          {pending.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#444', fontSize: 14 }}>
              No members pending JT assignment.
            </div>
          )}
          {pending.map((m, i) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 20px',
              borderBottom: i < pending.length - 1 ? '1px solid #0f1117' : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#f7934f20', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: '#f7934f',
              }}>
                {(m.preferred_name || m.full_name)[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>
                  {m.preferred_name || m.full_name}
                </div>
                <div style={{ fontSize: 11, color: '#555' }}>{m.email}</div>
                {m.graduation_year && (
                  <div style={{ fontSize: 11, color: '#444' }}>Class of {m.graduation_year}</div>
                )}
              </div>
              <select
                value={assignments[m.id] ?? ''}
                onChange={e => setAssignments(a => ({ ...a, [m.id]: e.target.value }))}
                style={{
                  padding: '7px 10px',
                  background: '#0f1117', border: '1px solid #2a2f45',
                  borderRadius: 7, color: '#ddd', fontSize: 13,
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                <option value="">Assign JT…</option>
                {jtFamilies.map(jt => (
                  <option key={jt.id} value={jt.id}>{jt.name}</option>
                ))}
              </select>
              <button
                onClick={() => assignJT(m.id)}
                disabled={!assignments[m.id] || saving === m.id}
                style={{
                  padding: '7px 14px',
                  background: assignments[m.id] ? '#4f6ef7' : '#2a2f45',
                  color: assignments[m.id] ? '#fff' : '#555',
                  border: 'none', borderRadius: 7,
                  fontSize: 13, fontWeight: 600,
                  cursor: assignments[m.id] ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit',
                }}
              >
                {saving === m.id ? 'Saving…' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Import tab */}
      {tab === 'import' && (
        <div style={{
          background: '#161a27', borderRadius: 14,
          border: '1px solid #1e2337', padding: 28,
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#ddd', marginBottom: 8 }}>
            Import from Google Form CSV
          </div>
          <div style={{ fontSize: 13, color: '#555', marginBottom: 20, lineHeight: 1.6 }}>
            Export responses from Google Forms as a CSV file. The form should collect:
            Full Name, Preferred Name, TAMU Email, Graduation Year, and Phone (optional).
          </div>

          <input
            type="file"
            accept=".csv"
            onChange={handleCSV}
            disabled={importing}
            style={{
              display: 'block', marginBottom: 20,
              color: '#888', fontSize: 13, fontFamily: 'inherit',
            }}
          />

          {importing && (
            <div style={{ fontSize: 13, color: '#555' }}>Importing…</div>
          )}

          {importResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                padding: 12, background: '#4fc78715',
                borderRadius: 8, border: '1px solid #4fc78730',
                fontSize: 13, color: '#4fc787',
              }}>
                ✅ {importResult.added} members added
              </div>
              {importResult.skipped > 0 && (
                <div style={{
                  padding: 12, background: '#ffffff08',
                  borderRadius: 8, border: '1px solid #2a2f45',
                  fontSize: 13, color: '#666',
                }}>
                  ⏭️ {importResult.skipped} already existed, skipped
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div style={{
                  padding: 12, background: '#e74c3c15',
                  borderRadius: 8, border: '1px solid #e74c3c30',
                }}>
                  <div style={{ fontSize: 13, color: '#e74c3c', marginBottom: 6 }}>
                    ⚠️ {importResult.errors.length} errors
                  </div>
                  {importResult.errors.map((err, i) => (
                    <div key={i} style={{ fontSize: 12, color: '#e74c3c80' }}>{err}</div>
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