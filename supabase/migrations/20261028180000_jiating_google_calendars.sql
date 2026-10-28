-- Per-Jiating Google Calendar targets, and the Google event id written to each one.
-- The shared member calendar still uses events.google_event_id.
-- Jiating Event and Jiating Mixer are copied onto each participating family's calendar.

ALTER TABLE public.jt_families
  ADD COLUMN IF NOT EXISTS google_calendar_id text;

COMMENT ON COLUMN public.jt_families.google_calendar_id IS
  'Google Calendar ID for one-way sync of this Jiating''s events. Null skips sync.';

CREATE TABLE public.event_jt_calendar_events (
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  jt_family_id uuid NOT NULL REFERENCES public.jt_families (id) ON DELETE CASCADE,
  google_calendar_id text NOT NULL,
  google_event_id text,
  synced_at timestamptz,
  sync_error text,
  PRIMARY KEY (event_id, jt_family_id)
);

COMMENT ON TABLE public.event_jt_calendar_events IS
  'Google event written for one app event on one Jiating calendar. google_calendar_id is the calendar that copy was created on.';

ALTER TABLE public.event_jt_calendar_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) reads or writes sync rows.
