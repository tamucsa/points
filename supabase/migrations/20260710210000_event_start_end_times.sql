-- Event start/end times (America/Chicago). Replaces date-only event_date.

CREATE OR REPLACE FUNCTION public.central_event_timestamp(p_date date, p_time time)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_date + p_time) AT TIME ZONE 'America/Chicago';
$$;

GRANT EXECUTE ON FUNCTION public.central_event_timestamp(date, time) TO authenticated;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz;

UPDATE public.events
SET starts_at = public.central_event_timestamp(event_date, time '12:00')
WHERE starts_at IS NULL AND event_date IS NOT NULL;

ALTER TABLE public.events
  ALTER COLUMN starts_at SET NOT NULL;

ALTER TABLE public.events
  DROP COLUMN IF EXISTS event_date;
