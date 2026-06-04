'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Member {
  id: string
  full_name: string
  preferred_name: string | null
  email: string
  profile_image_url: string | null
  jt_family: string | null
  jt_color: string | null
  total_points: number
  csa_points: number
  jt_points: number
  sports_points: number
  gm_points: number
}

interface Props {
  members: Member[]
  semester: { name: string } | null
}

export default function MembersClient({ members, semester }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filterJT, setFilterJT] = useState('all')

  const jtFamilies = [...new Set(members.map(m => m.jt_family).filter(Boolean))]

  const filtered = members.filter(m => {
    const matchesSearch =
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (m.preferred_name?.toLowerCase().includes(search.toLowerCase())) ||
      m.email.toLowerCase().includes(search.toLowerCase())
    const matchesJT = filterJT === 'all' || m.jt_family === filterJT
    return matchesSearch && matchesJT
  })

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Members</h1>
        <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
          {semester?.name} · {members.length} active members
        </div>
      </div>

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, padding: '10px 14px',
            background: '#161a27', border: '1px solid #2a2f45',
            borderRadius: 8, color: '#ddd', fontSize: 14,
            fontFamily: 'inherit', outline: 'none',
          }}
        />
        <select
          value={filterJT}
          onChange={e => setFilterJT(e.target.value)}
          style={{
            padding: '10px 14px',
            background: '#161a27', border: '1px solid #2a2f45',
            borderRadius: 8, color: '#ddd', fontSize: 14,
            fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
          }}
        >
          <option value="all">All JTs</option>
          {jtFamilies.map(jt => (
            <option key={jt} value={jt!}>{jt}</option>
          ))}
        </select>
      </div>

      {/* Members table */}
      <div style={{
        background: '#161a27', borderRadius: 14,
        border: '1px solid #1e2337', overflow: 'hidden',
      }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 120px 80px 80px 80px 80px 80px',
          padding: '10px 20px',
          borderBottom: '1px solid #1a1e2e',
          fontSize: 11, color: '#444', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <div>Member</div>
          <div>JT Family</div>
          <div style={{ textAlign: 'right' }}>Total</div>
          <div style={{ textAlign: 'right' }}>CSA</div>
          <div style={{ textAlign: 'right' }}>JT</div>
          <div style={{ textAlign: 'right' }}>Sports</div>
          <div style={{ textAlign: 'right' }}>GM</div>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#444', fontSize: 14 }}>
            No members found.
          </div>
        )}

        {filtered.map((m, i) => (
          <div
            key={m.id}
            onClick={() => router.push(`/officer/members/${m.id}`)}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 120px 80px 80px 80px 80px 80px',
              padding: '12px 20px',
              borderBottom: i < filtered.length - 1 ? '1px solid #0f1117' : 'none',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1a1e2e')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Member info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {m.profile_image_url ? (
                <img
                  src={m.profile_image_url}
                  style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: (m.jt_color ?? '#4f6ef7') + '30',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: m.jt_color ?? '#4f6ef7',
                }}>
                  {(m.preferred_name || m.full_name)[0]}
                </div>
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>
                  {m.preferred_name || m.full_name}
                </div>
                <div style={{ fontSize: 11, color: '#555' }}>{m.email}</div>
              </div>
            </div>

            {/* JT */}
            <div>
              {m.jt_family && (
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 20,
                  fontWeight: 600,
                  background: (m.jt_color ?? '#4f6ef7') + '20',
                  color: m.jt_color ?? '#4f6ef7',
                }}>
                  {m.jt_family}
                </span>
              )}
            </div>

            {/* Points */}
            <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              {m.total_points}
            </div>
            <div style={{ textAlign: 'right', fontSize: 13, color: '#666' }}>{m.csa_points}</div>
            <div style={{ textAlign: 'right', fontSize: 13, color: '#666' }}>{m.jt_points}</div>
            <div style={{ textAlign: 'right', fontSize: 13, color: '#666' }}>{m.sports_points}</div>
            <div style={{ textAlign: 'right', fontSize: 13, color: '#666' }}>{m.gm_points}</div>
          </div>
        ))}
      </div>
    </div>
  )
}