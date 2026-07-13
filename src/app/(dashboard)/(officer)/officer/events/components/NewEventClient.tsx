'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import BackLink from '@/app/components/BackLink'
import { createEvent } from '@/app/actions/events'
import IconLabel, { CheckInTypeBadge, ScopeBadge } from '@/app/components/IconLabel'
import PageHeader from '@/app/components/PageHeader'
import {
  EVENT_CATEGORIES,
  applyCategoryDefaults,
  getCategoryConfig,
  getCategoryOwnerHint,
  type EventCategory,
} from '@/utils/events'
import { CHECKIN_TYPE_LABELS, inputClassName, labelClassName } from '@/utils/constants'
import { CHECKIN_TYPE_ICONS } from '@/utils/icons'

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

const DEFAULT_CATEGORY: EventCategory = 'General Meeting'

const checkInTypeBtn = (active: boolean) =>
  `inline-flex min-h-11 w-full items-center justify-center rounded-xl border px-3 py-2.5 text-sm font-medium leading-none transition ${
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
  const [form, setForm] = useState(() => {
    const defaults = applyCategoryDefaults(DEFAULT_CATEGORY, {
      scope: 'org',
      check_in_type: 'officer',
      has_spectators: false,
    })
    return {
      name: '',
      category: DEFAULT_CATEGORY,
      point_value: defaults.point_value,
      scope: defaults.scope,
      jt_family_id: officerJtFamilyId ?? '',
      check_in_type: defaults.check_in_type,
      event_date: '',
      start_time: '',
      end_time: '',
      location: '',
      description: '',
      rsvp_url: '',
      rsvp_deadline: '',
      has_spectators: defaults.has_spectators,
    }
  })

  const set = (key: string, value: string | boolean) =>
    setForm(f => ({ ...f, [key]: value }))

  const categoryConfig = getCategoryConfig(form.category)
  const categoryOwnerHint = getCategoryOwnerHint(form.category)
  const fixedCheckIn = categoryConfig?.checkInType
  const effectiveCheckIn = fixedCheckIn ?? form.check_in_type
  const isSports = categoryConfig?.allowSpectators === true
  const isJTSpecific = form.scope === 'jt_specific'
  const isRSVP = effectiveCheckIn === 'rsvp_required'
  const isSelf = effectiveCheckIn === 'self'

  const handleCategoryChange = (category: string) => {
    setForm(f => ({
      ...f,
      ...applyCategoryDefaults(category as EventCategory, {
        scope: f.scope,
        check_in_type: f.check_in_type,
        has_spectators: f.has_spectators,
      }),
    }))
  }

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
      checkInType: effectiveCheckIn,
      eventDate: form.event_date,
      startTime: form.start_time,
      endTime: form.end_time.trim() || null,
      location: form.location.trim(),
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
    router.replace('/officer/events')
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 lg:px-8">
      <BackLink href="/officer/events" label="Back to Events" replace />
      <PageHeader title="New Event" subtitle={semesterName} />

      <div className="mt-6 flex flex-col gap-5 rounded-4xl border border-home-border bg-white p-6 shadow-sm">
        <div>
          <label className={labelClassName}>Event Name *</label>
          <input className={inputClassName} placeholder="e.g. First Friday March" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>

        <div>
          <label className={labelClassName}>Category *</label>
          <select
            className={`${inputClassName} cursor-pointer`}
            value={form.category}
            onChange={e => handleCategoryChange(e.target.value)}
          >
            {EVENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {categoryConfig && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-subtitle">
              <span className="rounded-md bg-bg px-2 py-1">
                {categoryConfig.pointValue} pt{categoryConfig.pointValue === 1 ? '' : 's'}
              </span>
              <span className="rounded-md bg-bg px-2 py-1">
                <ScopeBadge scope={categoryConfig.scope} />
              </span>
              {fixedCheckIn && (
                <span className="rounded-md bg-bg px-2 py-1">
                  <CheckInTypeBadge checkInType={effectiveCheckIn} />
                </span>
              )}
            </div>
          )}
          {categoryOwnerHint && (
            <p className="mt-2 text-xs leading-5 text-subtitle">
              {categoryOwnerHint}.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClassName}>Date *</label>
            <input type="date" className={inputClassName} value={form.event_date} onChange={e => set('event_date', e.target.value)} />
          </div>
          <div>
            <label className={labelClassName}>Start Time *</label>
            <input type="time" className={inputClassName} value={form.start_time} onChange={e => set('start_time', e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClassName}>End Time <span className="font-normal normal-case text-subtitle">(optional)</span></label>
            <input type="time" className={inputClassName} value={form.end_time} onChange={e => set('end_time', e.target.value)} />
          </div>
          <div>
            <label className={labelClassName}>Location *</label>
            <input className={inputClassName} placeholder="e.g. MSC 2406" value={form.location} onChange={e => set('location', e.target.value)} required />
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

        {!fixedCheckIn && (
          <div>
            <label className={labelClassName}>Check-in Type *</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  { value: 'officer', label: CHECKIN_TYPE_LABELS.officer, icon: CHECKIN_TYPE_ICONS.officer },
                  { value: 'self', label: CHECKIN_TYPE_LABELS.self, icon: CHECKIN_TYPE_ICONS.self },
                  { value: 'rsvp_required', label: CHECKIN_TYPE_LABELS.rsvp_required, icon: CHECKIN_TYPE_ICONS.rsvp_required },
                ] as const
              ).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set('check_in_type', opt.value)}
                  className={checkInTypeBtn(form.check_in_type === opt.value)}
                >
                  <IconLabel
                    icon={opt.icon}
                    label={opt.label}
                    size="sm"
                    className="justify-center"
                    iconClassName={form.check_in_type === opt.value ? 'text-primary' : 'text-subtitle'}
                    labelClassName={form.check_in_type === opt.value ? 'text-primary' : ''}
                  />
                </button>
              ))}
            </div>
            {isSelf && (
              <p className="mt-2 text-xs text-subtitle">A QR code is generated automatically when the event is created.</p>
            )}
          </div>
        )}

        {fixedCheckIn === 'self' && (
          <p className="text-xs text-subtitle">Members scan a QR code to check themselves in.</p>
        )}

        {isRSVP && (
          <div className="space-y-4 rounded-2xl border border-home-border bg-bg p-4">
            <p className="text-xs text-subtitle">
              RSVP link and deadline are optional now — you can add them later from the event detail page once the form is ready.
            </p>
            <div>
              <label className={labelClassName}>RSVP Link <span className="font-normal normal-case text-subtitle">(optional)</span></label>
              <input className={inputClassName} placeholder="https://forms.gle/..." value={form.rsvp_url} onChange={e => set('rsvp_url', e.target.value)} />
            </div>
            <div>
              <label className={labelClassName}>RSVP Deadline <span className="font-normal normal-case text-subtitle">(optional)</span></label>
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
