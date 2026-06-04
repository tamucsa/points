'use client'
import { useState } from 'react'

interface Member {
  id: string
  full_name: string
  preferred_name: string
  email: string
  profile_image_url: string
  jt_family: string
  jt_color: string
  total_points: number
  csa_points: number
  jt_points: number
  sports_points: number
  gm_points: number
}

interface JTTotal {
  jt_family: string
  jt_color: string
  member_count: number
  total_points: number
  avg_points_per_member: number
}

interface Semester {
  name: string
}

interface Props {
  members: Member[]
  jtTotals: JTTotal[]
  semester: Semester | null
}

const TABS = ['Overall', 'By JT']

export default function LeaderboardClient({ members, jtTotals, semester }: Props) {
  const [tab, setTab] = useState('Overall')
  const maxPts = members[0]?.total_points ?? 1

  return (
    <div style={{ padding: 28, maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>Leaderboard</h1>
          <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
            {semester?.name ?? 'Current Semester'} · {members.length} members
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: '#0f1117', padding: 4, borderRadius: 8 }}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                background: tab === t ? '#1e2337' : 'transparent',
                color: tab === t ? '#fff' : '#555',
                transition: 'all 0.15s',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Overall tab */}
      {tab === 'Overall' && (
        <div style={{ background: '#161a27', borderRadius: 14, border: '1px solid #1e2337', overflow: 'hidden' }}>
          {/* Column headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 1fr 70px 70px 70px 100px',
            padding: '10px 20px',
            borderBottom: '1px solid #1a1e2e',
            fontSize: 11,
            color: '#444',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            <div>#</div>
            <div>Member</div>
            <div style={{ textAlign: 'right' }}>Total</div>
            <div style={{ textAlign: 'right' }}>CSA</div>
            <div style={{ textAlign: 'right' }}>JT</div>
            <div style={{ paddingLeft: 12 }}>Progress</div>
          </div>

          {members.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#444', fontSize: 14 }}>
              No active members yet.
            </div>
          )}

          {members.map((m, i) => (
            <div
              key={m.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 70px 70px 70px 100px',
                padding: '12px 20px',
                borderBottom: i < members.length - 1 ? '1px solid #0f1117' : 'none',
                alignItems: 'center',
              }}
            >
              {/* Rank */}
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : '#333',
              }}>
                {i + 1}
              </div>

              {/* Member info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {m.profile_image_url ? (
                  <img
                    src={m.profile_image_url}
                    alt={m.preferred_name}
                    style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }}
                  />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: (m.jt_color ?? '#4f6ef7') + '30',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                    color: m.jt_color ?? '#4f6ef7',
                    flexShrink: 0,
                  }}>
                    {m.preferred_name?.[0] ?? m.full_name?.[0]}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>
                    {m.preferred_name || m.full_name}
                  </div>
                  {m.jt_family && (
                    <span style={{
                      display: 'inline-block',
                      padding: '1px 7px',
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: (m.jt_color ?? '#4f6ef7') + '20',
                      color: m.jt_color ?? '#4f6ef7',
                      marginTop: 2,
                    }}>
                      {m.jt_family}
                    </span>
                  )}
                </div>
              </div>

              {/* Points */}
              <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 700, color: '#fff' }}>
                {m.total_points}
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, color: '#666' }}>
                {m.csa_points}
              </div>
              <div style={{ textAlign: 'right', fontSize: 13, color: '#666' }}>
                {m.jt_points}
              </div>

              {/* Progress bar */}
              <div style={{ paddingLeft: 12 }}>
                <div style={{ height: 4, background: '#1a1e2e', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(m.total_points / maxPts) * 100}%`,
                    background: m.jt_color ?? '#4f6ef7',
                    borderRadius: 4,
                    transition: 'width 0.3s',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* By JT tab */}
      {tab === 'By JT' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {jtTotals.length === 0 && (
            <div style={{ gridColumn: 'span 2', padding: 40, textAlign: 'center', color: '#444', fontSize: 14 }}>
              No JT data yet.
            </div>
          )}
          {[...jtTotals].sort((a, b) => b.total_points - a.total_points).map((jt, i) => (
            <div
              key={jt.jt_family}
              style={{ padding: 20, background: '#161a27', borderRadius: 14, border: '1px solid #1e2337' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: jt.jt_color ?? '#4f6ef7' }} />
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{jt.jt_family}</span>
                  {i === 0 && <span style={{ fontSize: 14 }}>👑</span>}
                </div>
                <div style={{ fontSize: 11, color: '#555' }}>{jt.member_count} members</div>
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: jt.jt_color ?? '#4f6ef7', letterSpacing: '-1px' }}>
                {jt.total_points}
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>total points</div>
              <div style={{ fontSize: 12, color: '#444', marginTop: 4 }}>
                {jt.avg_points_per_member} avg per member
              </div>
              <div style={{ height: 4, background: '#1a1e2e', borderRadius: 4, marginTop: 14, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(jt.total_points / (jtTotals[0]?.total_points || 1)) * 100}%`,
                  background: jt.jt_color ?? '#4f6ef7',
                  borderRadius: 4,
                }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}