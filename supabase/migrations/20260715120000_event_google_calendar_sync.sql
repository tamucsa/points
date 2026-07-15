-- Google Calendar sync metadata for app → CSA Member Calendar pushes.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_sync_error text;

COMMENT ON COLUMN public.events.google_event_id IS
  'Google Calendar event id when synced to the CSA Member Calendar';
COMMENT ON COLUMN public.events.google_synced_at IS
  'Last successful Google Calendar sync timestamp';
COMMENT ON COLUMN public.events.google_sync_error IS
  'Last Google Calendar sync error message (cleared on success)';
