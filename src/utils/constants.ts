export const OFFICER_MEMBERS_PAGE_SIZE = 25
export const EVENTS_PAGE_SIZE = 10

export const inputClassName =
  'w-full rounded-xl border border-home-border bg-surface px-4 py-3 text-sm text-text outline-none transition placeholder:text-subtitle focus:border-primary focus:ring-2 focus:ring-primary/15'

export const primaryButtonClassName =
  'inline-flex items-center justify-center rounded-xl bg-primary px-4 py-3 text-[15px] font-semibold text-on-primary shadow-theme-primary transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-disabled'

export const errorAlertClassName =
  'rounded-2xl border border-error-border bg-error-bg p-3.5'

export const errorTextClassName = 'text-sm leading-6 text-error'

export const cardClassName =
  'overflow-hidden rounded-4xl border border-home-border bg-surface shadow-theme-lg'

export const labelClassName =
  'mb-2 block text-xs font-semibold uppercase tracking-[0.06em] text-subtitle'

export const POINT_COLORS: Record<number, string> = {
  3: '#4779B8',
  2: '#f7934f',
  1: '#4fc787',
}

export const SCOPE_LABELS: Record<string, string> = {
  org: 'CSA-Wide',
  jt_shared: 'JT Shared',
  jt_specific: 'JT Specific',
}

export const CHECKIN_TYPE_LABELS: Record<string, string> = {
  officer: 'Officer Check-in',
  self: 'Self Check-in',
  rsvp_required: 'RSVP',
  csv_import: 'CSV Check-in',
  manual_points: 'Manual Points',
}

export const CHECKIN_METHOD_LABELS: Record<string, string> = {
  officer: 'Officer',
  qr_scan: 'QR Scan',
  self: 'Self',
  csv_import: 'CSV Import',
  manual: 'Manual',
}

export const POINT_BUCKET_LABELS = {
  csa: 'CSA',
  jt: 'Jiating',
  sports: 'Sports & Dance',
  gm: 'General Meeting',
} as const

/** Member-facing / UI constants — keep in sync with DB cap logic and OPERATIONS.md. */
export const SPORTS_SPECTATOR_SEMESTER_CAP = 10
export const JT_EVENT_MIXER_WEEKLY_ATTENDANCE_CAP = 4

export const CATEGORY_COLORS: Record<string, string> = {
  'CSA-Wide': '#4779B8',
  'CSA-Wide Mixers': '#5a8fd4',
  'Jiating Olympics': '#f7934f',
  'Jiating Event': '#6b7fd7',
  Sports: '#4fc787',
  'Sports Spectator': '#4fc787',
  'General Meeting': '#e8b84b',
  'Jiating Mixer': '#9b6dd7',
  Mixer: '#9b6dd7',
  Philanthropy: '#e85d8a',
  Dance: '#5bc4d4',
  Concessions: '#c9a227',
  default: '#888',
}
