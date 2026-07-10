export const OFFICER_MEMBERS_PAGE_SIZE = 25

export const inputClassName =
  'w-full rounded-xl border border-home-border bg-white px-4 py-3 text-sm text-text outline-none transition placeholder:text-[#8b96aa] focus:border-primary focus:ring-2 focus:ring-primary/15'

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
  officer: 'Officer',
  self: 'QR Code',
  rsvp_required: 'RSVP',
}

export const CHECKIN_METHOD_LABELS: Record<string, string> = {
  officer: 'Officer',
  qr_scan: 'QR Scan',
  self: 'Self',
}

export const POINT_BUCKET_LABELS = {
  csa: 'CSA',
  jt: 'JT',
  sports: 'Sports & Dance',
  gm: 'General Meeting',
} as const

export const CATEGORY_COLORS: Record<string, string> = {
  'CSA-Wide': '#4779B8',
  'Jiating Olympics': '#f7934f',
  Sports: '#4fc787',
  'Sports Spectator': '#4fc787',
  'General Meeting': '#e8b84b',
  Mixer: '#9b6dd7',
  Philanthropy: '#e85d8a',
  Dance: '#5bc4d4',
  Concessions: '#c9a227',
  default: '#888',
}
