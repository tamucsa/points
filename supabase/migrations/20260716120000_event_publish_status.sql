-- Event draft / scheduled / published workflow (members only see published).

DO $$ BEGIN
  CREATE TYPE public.event_publish_status AS ENUM ('draft', 'scheduled', 'published');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS publish_status public.event_publish_status NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

COMMENT ON COLUMN public.events.publish_status IS
  'draft = officer-only; scheduled = officer-only until publish_at; published = visible to members';
COMMENT ON COLUMN public.events.publish_at IS
  'When status=scheduled, auto-publish at this timestamptz (stored UTC; UI is America/Chicago)';
COMMENT ON COLUMN public.events.published_at IS
  'When the event became visible to members (and eligible for Calendar sync)';

-- Existing rows are live; treat as already published.
UPDATE public.events
SET published_at = COALESCE(published_at, created_at, now())
WHERE publish_status = 'published'
  AND published_at IS NULL;

CREATE INDEX IF NOT EXISTS events_scheduled_publish_at_idx
  ON public.events (publish_at)
  WHERE publish_status = 'scheduled';

-- Members must only SELECT published events (officers keep full SELECT).
DROP POLICY IF EXISTS "Active members can view org and jt_shared events" ON public.events;
CREATE POLICY "Active members can view org and jt_shared events"
  ON public.events FOR SELECT
  USING (
    publish_status = 'published'::public.event_publish_status
    AND scope = ANY (ARRAY['org'::event_scope, 'jt_shared'::event_scope])
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.auth_uid = auth.uid() AND m.status = 'active'::member_status
    )
  );

DROP POLICY IF EXISTS "Active members can view their JT events" ON public.events;
CREATE POLICY "Active members can view their JT events"
  ON public.events FOR SELECT
  USING (
    publish_status = 'published'::public.event_publish_status
    AND scope = 'jt_specific'::event_scope
    AND jt_family_id = get_my_jt_family_id()
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.auth_uid = auth.uid() AND m.status = 'active'::member_status
    )
  );
