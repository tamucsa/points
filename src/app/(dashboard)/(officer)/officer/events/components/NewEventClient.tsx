'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createEvent } from '@/app/actions/events'
import { inputClassName, labelClassName } from '@/utils/constants'

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
}

const CATEGORIES = [
  'GM', 'CSA', 'JT_Olympics', 'Mixer', 'Sports', 'Sports Spectator',
  'Philanthropy', 'First Friday', 'Intern Event', 'Dance', 'Other',
]

const scopeBtn = (active: boolean) =>
  `flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
    active
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-home-border bg-white text-subtitle hover:border-primary/30'
  }`

export default function NewEventClient({
  semesterId,
  semesterName,
  jtFamilies,
  officerJtFamilyId,
  createdBy,
}: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    category: 'GM',
    point_value: '1',
    scope: 'org',
    jt_family_id: officerJtFamilyId ?? '',
    check_in_type: 'officer',
    event_date: '',
    location: '',
    description: '',
    rsvp_url: '',
    rsvp_deadline: '',
    has_spectators: false,
  })

  const set = (key: string, value: string | boolean) =>
    setForm(f => ({ ...f, [key]: value }))

  const isSports = form.category === 'Sports'
  const isJTSpecific = form.scope === 'jt_specific'
  const isRSVP = form.check_in_type === 'rsvp_required'
  const isSelf = form.check_in_type === 'self'

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    const result = await createEvent({
      semesterId,
      name: form.name,
      category: form.category,
      pointValue: parseInt(form.point_value),
      scope: form.scope,
      jtFamilyId: isJTSpecific ? form.jt_family_id : null,
      checkInType: form.check_in_type,
      eventDate: form.event_date,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
      rsvpUrl: isRSVP && form.rsvp_url ? form.rsvp_url.trim() : null,
      rsvpDeadline: isRSVP && form.rsvp_deadline ? form.rsvp_deadline : null,
      createdBy,
      hasSpectators: isSports && form.has_spectators,
    })

    setSubmitting(false)
    if (!result.success) {
      setError(result.error ?? 'Failed to create event.')
      return
    }
    router.push('/officer/events')
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 lg:px-8">
      <button onClick={() => router.back()} className="mb-4 text-sm text-subtitle hover:text-primary">
        ← Back
      </button>
      <h1 className="text-3xl font-bold text-text">New Event</h1>
      <p className="mt-1 text-sm text-subtitle">{semesterName}</p>

      <div className="mt-6 flex flex-col gap-5 rounded-4xl border border-home-border bg-white p-6 shadow-sm">
        <div>
          <label className={labelClassName}>Event Name *</label>
          <input className={inputClassName} placeholder="e.g. First Friday March" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClassName}>Category *</label>
            <select className={`${inputClassName} cursor-pointer`} value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Point Value *</label>
            <select className={`${inputClassName} cursor-pointer`} value={form.point_value} onChange={e => set('point_value', e.target.value)}>
              <option value="1">1 point</option>
              <option value="2">2 points</option>
              <option value="3">3 points</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClassName}>Date *</label>
            <input type="date" className={inputClassName} value={form.event_date} onChange={e => set('event_date', e.target.value)} />
          </div>
          <div>
            <label className={labelClassName}>Location</label>
            <input className={inputClassName} placeholder="e.g. MSC 2406" value={form.location} onChange={e => set('location', e.target.value)} />
          </div>
        </div>

        <div>
          <label className={labelClassName}>Event Scope *</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'org', label: '🏫 CSA-Wide' },
              { value: 'jt_shared', label: '🏅 JT Shared' },
              { value: 'jt_specific', label: '🏠 JT Specific' },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => set('scope', opt.value)} className={scopeBtn(form.scope === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {isJTSpecific && (
          <div>
            <label className={labelClassName}>JT Family *</label>
            <select className={`${inputClassName} cursor-pointer`} value={form.jt_family_id} onChange={e => set('jt_family_id', e.target.value)}>
              <option value="">Select JT family…</option>
              {jtFamilies.map(jt => <option key={jt.id} value={jt.id}>{jt.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className={labelClassName}>Check-in Type *</label>
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'officer', label: '👤 Officer' },
              { value: 'self', label: '🔲 QR Code' },
              { value: 'rsvp_required', label: '📋 RSVP' },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => set('check_in_type', opt.value)} className={scopeBtn(form.check_in_type === opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
          {isSelf && (
            <p className="mt-2 text-xs text-subtitle">A QR code is generated automatically when the event is created.</p>
          )}
        </div>

        {isRSVP && (
          <div className="space-y-4 rounded-2xl border border-home-border bg-bg p-4">
            <div>
              <label className={labelClassName}>RSVP Link</label>
              <input className={inputClassName} placeholder="https://forms.gle/..." value={form.rsvp_url} onChange={e => set('rsvp_url', e.target.value)} />
            </div>
            <div>
              <label className={labelClassName}>RSVP Deadline</label>
              <input type="datetime-local" className={inputClassName} value={form.rsvp_deadline} onChange={e => set('rsvp_deadline', e.target.value)} />
            </div>
          </div>
        )}

        {isSports && (
          <div className="flex items-center justify-between rounded-2xl border border-home-border bg-bg p-4">
            <div>
              <div className="text-sm font-semibold text-text">Enable Spectator Check-in</div>
              <div className="mt-1 text-xs text-subtitle">Separate QR event worth 1 pt (capped at 10/semester)</div>
            </div>
            <button
              type="button"
              onClick={() => set('has_spectators', !form.has_spectators)}
              className={`relative h-6 w-11 rounded-full transition ${form.has_spectators ? 'bg-primary' : 'bg-home-border'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${form.has_spectators ? 'left-[1.35rem]' : 'left-0.5'}`} />
            </button>
          </div>
        )}

        <div>
          <label className={labelClassName}>Description <span className="font-normal normal-case text-subtitle">(optional)</span></label>
          <textarea className={`${inputClassName} min-h-24 resize-y`} placeholder="Additional details…" value={form.description} onChange={e => set('description', e.target.value)} />
        </div>

        {error && (
          <div className="rounded-2xl border border-[#f5b0b0] bg-[#fff4f4] p-3">
            <p className="text-sm text-[#c94b4b]">{error}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-white disabled:bg-[#9cb8d8]"
        >
          {submitting ? 'Creating…' : 'Create Event'}
        </button>
      </div>
    </div>
  )
}
