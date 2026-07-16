-- Members can see their own RSVP tags (for Events list badges). Officers keep full access.

CREATE POLICY "Members can view own event rsvps"
  ON public.event_rsvps
  FOR SELECT
  TO authenticated
  USING (
    member_id IS NOT NULL
    AND member_id = (
      SELECT m.id
      FROM public.members m
      WHERE m.auth_uid = auth.uid()
      LIMIT 1
    )
  );
