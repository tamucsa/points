'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

interface JTFamily {
  id: string
  name: string
}

interface Props {
  semesterId: string
  semesterName: string
  jtFamilies: JTFamily[]
  officerJtFamilyId: string | null
  createdBy: string
  isAdmin: boolean
}

const CATEGORIES = [
  'GM',
  'CSA',
  'JT_Olympics',
  'Mixer',
  'Sports',
  'Sports Spectator',
  'Philanthropy',
  'First Friday',
  'Intern Event',
  'Dance',
  'Other',
]

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: '#0f1117',
  border: '1px solid #2a2f45',
  borderRadius: 8,
  color: '#ddd',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: '#888',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: 6,
}

export default function NewEventClient({
  semesterId,
  semesterName,
  jtFamilies,
  officerJtFamilyId,
  createdBy,
  isAdmin,
}: Props) {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name:           '',
    category:       'GM',
    point_value:    '1',
    scope:          'org',
    jt_family_id:   officerJtFamilyId ?? '',
    check_in_type:  'officer',
    event_date:     '',
    location:       '',
    description:    '',
    rsvp_url:       '',
    rsvp_deadline:  '',
    // Sports dual check-in
    has_spectators: false,
  })

  const set = (key: string, value: string | boolean) =>
    setForm(f => ({ ...f, [key]: value }))

  const isSports    = form.category === 'Sports'
  const isJTSpecific = form.scope === 'jt_specific'
  const isRSVP      = form.check_in_type === 'rsvp_required'
  const isSelf      = form.check_in_type === 'self'

  const handleSubmit = async () => {
    setError(null)

    // Validation
    if (!form.name.trim())    return setError('Event name is required.')
    if (!form.event_date)     return setError('Event date is required.')
    if (isJTSpecific && !form.jt_family_id) return setError('JT family is required for JT-specific events.')

    setSubmitting(true)

    // Insert main event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        semester_id:   semesterId,
        name:          form.name.trim(),
        category:      form.category,
        point_value:   parseInt(form.point_value),
        scope:         form.scope,
        jt_family_id:  isJTSpecific ? form.jt_family_id : null,
        check_in_type: form.check_in_type,
        event_date:    form.event_date,
        location:      form.location.trim() || null,
        description:   form.description.trim() || null,
        rsvp_url:      isRSVP && form.rsvp_url ? form.rsvp_url.trim() : null,
        rsvp_deadline: isRSVP && form.rsvp_deadline ? form.rsvp_deadline : null,
        created_by:    createdBy,
      })
      .select()
      .single()

    if (eventError || !event) {
      setError('Failed to create event. Please try again.')
      setSubmitting(false)
      return
    }

    // If Sports with spectators, create the linked spectator event
    if (isSports && form.has_spectators) {
      await supabase.from('events').insert({
        semester_id:     semesterId,
        name:            `${form.name.trim()} — Spectator`,
        category:        'Sports Spectator',
        point_value:     1,
        scope:           form.scope,
        jt_family_id:    isJTSpecific ? form.jt_family_id : null,
        check_in_type:   'self',
        event_date:      form.event_date,
        location:        form.location.trim() || null,
        created_by:      createdBy,
        parent_event_id: event.id,
      })
    }

    router.push('/officer/events')
  }

  return (
    <div style={{ padding: 28, maxWidth: 640, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none', border: 'none', color: '#555',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
            padding: 0, marginBottom: 12,
          }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>New Event</h1>
        <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{semesterName}</div>
      </div>

      <div style={{
        background: '#161a27', borderRadius: 14,
        border: '1px solid #1e2337', padding: 28,
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>

        {/* Name */}
        <div>
          <label style={labelStyle}>Event Name *</label>
          <input
            style={inputStyle}
            placeholder="e.g. First Friday March"
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </div>

        {/* Category + Points row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Category *</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.category}
              onChange={e => set('category', e.target.value)}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Point Value *</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.point_value}
              onChange={e => set('point_value', e.target.value)}
            >
              <option value="1">1 point</option>
              <option value="2">2 points</option>
              <option value="3">3 points</option>
            </select>
          </div>
        </div>

        {/* Date + Location row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Date *</label>
            <input
              type="date"
              style={inputStyle}
              value={form.event_date}
              onChange={e => set('event_date', e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input
              style={inputStyle}
              placeholder="e.g. MSC 2406"
              value={form.location}
              onChange={e => set('location', e.target.value)}
            />
          </div>
        </div>

        {/* Scope */}
        <div>
          <label style={labelStyle}>Event Scope *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: 'org',         label: '🏫 CSA-Wide' },
              { value: 'jt_shared',   label: '🏅 JT Shared' },
              { value: 'jt_specific', label: '🏠 JT Specific' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => set('scope', opt.value)}
                style={{
                  flex: 1, padding: '8px 12px',
                  background: form.scope === opt.value ? '#4f6ef720' : '#0f1117',
                  border: `1px solid ${form.scope === opt.value ? '#4f6ef7' : '#2a2f45'}`,
                  color: form.scope === opt.value ? '#4f6ef7' : '#666',
                  borderRadius: 8, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* JT Family selector — only for jt_specific */}
        {isJTSpecific && (
          <div>
            <label style={labelStyle}>JT Family *</label>
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={form.jt_family_id}
              onChange={e => set('jt_family_id', e.target.value)}
            >
              <option value="">Select JT family…</option>
              {jtFamilies.map(jt => (
                <option key={jt.id} value={jt.id}>{jt.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Check-in type */}
        <div>
          <label style={labelStyle}>Check-in Type *</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: 'officer',       label: '👤 Officer' },
              { value: 'self',          label: '🔲 QR Code' },
              { value: 'rsvp_required', label: '📋 RSVP' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => set('check_in_type', opt.value)}
                style={{
                  flex: 1, padding: '8px 12px',
                  background: form.check_in_type === opt.value ? '#4f6ef720' : '#0f1117',
                  border: `1px solid ${form.check_in_type === opt.value ? '#4f6ef7' : '#2a2f45'}`,
                  color: form.check_in_type === opt.value ? '#4f6ef7' : '#666',
                  borderRadius: 8, fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {isSelf && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
              A QR code will be automatically generated after creating the event.
            </div>
          )}
        </div>

        {/* RSVP fields */}
        {isRSVP && (
          <div style={{
            padding: 16, background: '#0f1117',
            borderRadius: 10, border: '1px solid #2a2f45',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div>
              <label style={labelStyle}>RSVP Link</label>
              <input
                style={inputStyle}
                placeholder="https://forms.gle/..."
                value={form.rsvp_url}
                onChange={e => set('rsvp_url', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>RSVP Deadline</label>
              <input
                type="datetime-local"
                style={inputStyle}
                value={form.rsvp_deadline}
                onChange={e => set('rsvp_deadline', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Sports spectator toggle */}
        {isSports && (
          <div style={{
            padding: 16, background: '#0f1117',
            borderRadius: 10, border: '1px solid #2a2f45',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>
                  Enable Spectator Check-in
                </div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                  Creates a separate QR check-in for spectators worth 1 point (capped at 10/semester)
                </div>
              </div>
              <button
                onClick={() => set('has_spectators', !form.has_spectators)}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: form.has_spectators ? '#4f6ef7' : '#2a2f45',
                  border: 'none', cursor: 'pointer',
                  position: 'relative', transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', position: 'absolute',
                  top: 3, transition: 'left 0.2s',
                  left: form.has_spectators ? 23 : 3,
                }} />
              </button>
            </div>
          </div>
        )}

        {/* Description */}
        <div>
          <label style={labelStyle}>Description <span style={{ color: '#444', fontWeight: 400 }}>(optional)</span></label>
          <textarea
            style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
            placeholder="Any additional details about this event…"
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: 12, background: '#e74c3c15',
            borderRadius: 8, border: '1px solid #e74c3c30',
          }}>
            <p style={{ fontSize: 13, color: '#e74c3c' }}>{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            padding: '12px',
            background: submitting ? '#2a2f45' : '#4f6ef7',
            color: submitting ? '#555' : '#fff',
            border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
        >
          {submitting ? 'Creating…' : 'Create Event'}
        </button>

      </div>
    </div>
  )
}