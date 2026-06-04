'use client'
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

interface AttendanceRow {
  id: string
  check_in_method: string
  verified: boolean
  counted: boolean
  recorded_at: string
  events: {
    name: string
    category: string
    point_value: number
    event_date: string
  }
}

interface SemesterSummary {
  id: string
  total_points: number
  jt_family_name: string
  semesters: { name: string }
}

interface Props {
  member: Member
  attendance: AttendanceRow[]
  history: SemesterSummary[]
}

const CATEGORY_COLORS: Record<string, string> = {
  CSA:     '#4f6ef7',
  JT:      '#f7934f',
  Sports:  '#4fc787',
  GM:      '#e8b84b',
  default: '#888',
}

export default function MemberDetailClient({ member, attendance, history }: Props) {
  const router = useRouter()
  const color = member.jt_color ?? '#4f6ef7'
  const displayName = member.preferred_name || member.full_name

  const breakdown = [
    { label: 'CSA',    value: member.csa_points,    color: CATEGORY_COLORS.CSA    },
    { label: 'JT',     value: member.jt_points,     color: CATEGORY_COLORS.JT     },
    { label: 'Sports', value: member.sports_points, color: CATEGORY_COLORS.Sports },
    { label: 'GM',     value: member.gm_points,     color: CATEGORY_COLORS.GM     },
  ]

  return (
    <div style={{ padding: 28, maxWidth: 800, margin: '0 auto' }}>

      <button
        onClick={() => router.back()}
        style={{
          background: 'none', border: 'none', color: '#555',
          cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 13, padding: 0, marginBottom: 20,
        }}
      >
        ← Back
      </button>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        marginBottom: 24, padding: 24,
        background: '#161a27', borderRadius: 14, border: '1px solid #1e2337',
      }}>
        {member.profile_image_url ? (
          <img src={member.profile_image_url} style={{ width: 64, height: 64, borderRadius: '50%' }} />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: color + '30', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700, color,
          }}>
            {displayName[0]}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{displayName}</div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{member.email}</div>
          {member.jt_family && (
            <span style={{
              display: 'inline-block', marginTop: 6,
              padding: '2px 10px', borderRadius: 20,
              fontSize: 12, fontWeight: 600,
              background: color + '20', color,
            }}>
              {member.jt_family}
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', letterSpacing: '-2px' }}>
            {member.total_points}
          </div>
          <div style={{ fontSize: 12, color: '#555' }}>total points</div>
        </div>
      </div>

      {/* Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {breakdown.map(cat => (
          <div key={cat.label} style={{
            padding: 16, background: '#161a27',
            borderRadius: 12, border: '1px solid #1e2337', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: cat.color }}>{cat.value}</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{cat.label}</div>
          </div>
        ))}
      </div>

      {/* Attendance history */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
          This Semester
        </h2>
        <div style={{
          background: '#161a27', borderRadius: 14,
          border: '1px solid #1e2337', overflow: 'hidden',
        }}>
          {attendance.length === 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: '#444', fontSize: 14 }}>
              No events attended yet.
            </div>
          )}
          {attendance.map((row, i) => {
            const cat = row.events?.category ?? 'default'
            const catColor = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.default
            return (
              <div key={row.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 20px',
                borderBottom: i < attendance.length - 1 ? '1px solid #0f1117' : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: catColor + '20',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: catColor,
                }}>
                  {row.counted ? `+${row.events?.point_value}` : '—'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>
                    {row.events?.name}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 11, color: '#555' }}>{row.events?.event_date}</span>
                    <span style={{
                      fontSize: 11, padding: '1px 6px', borderRadius: 4,
                      background: catColor + '15', color: catColor,
                    }}>
                      {cat}
                    </span>
                    {!row.verified && (
                      <span style={{
                        fontSize: 11, padding: '1px 6px', borderRadius: 4,
                        background: '#f7934f15', color: '#f7934f',
                      }}>
                        Unverified
                      </span>
                    )}
                    {!row.counted && (
                      <span style={{
                        fontSize: 11, padding: '1px 6px', borderRadius: 4,
                        background: '#e74c3c15', color: '#e74c3c',
                      }}>
                        Cap reached
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Semester history */}
      {history.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 12 }}>
            Past Semesters
          </h2>
          <div style={{
            background: '#161a27', borderRadius: 14,
            border: '1px solid #1e2337', overflow: 'hidden',
          }}>
            {history.map((sem, i) => (
              <div key={sem.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: i < history.length - 1 ? '1px solid #0f1117' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#ddd' }}>
                    {sem.semesters?.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                    {sem.jt_family_name}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
                  {sem.total_points} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}