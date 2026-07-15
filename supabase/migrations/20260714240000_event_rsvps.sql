-- RSVP CSV tags for check-in (matched members + unmatched / guest rows).
-- One table; member_id NULL until matched or marked guest.

CREATE TABLE public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  member_id uuid REFERENCES public.members (id) ON DELETE SET NULL,
  email text NOT NULL,
  full_name text,
  is_guest boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_rsvps_event_email_key UNIQUE (event_id, email)
);

CREATE INDEX idx_event_rsvps_event_id ON public.event_rsvps (event_id);
CREATE INDEX idx_event_rsvps_member_id ON public.event_rsvps (member_id)
  WHERE member_id IS NOT NULL;
CREATE INDEX idx_event_rsvps_unmatched ON public.event_rsvps (event_id)
  WHERE member_id IS NULL AND is_guest = false;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY officers_read_event_rsvps
  ON public.event_rsvps FOR SELECT
  USING (get_my_role() IN ('officer', 'admin'));

CREATE POLICY officers_insert_event_rsvps
  ON public.event_rsvps FOR INSERT
  WITH CHECK (get_my_role() IN ('officer', 'admin'));

CREATE POLICY officers_update_event_rsvps
  ON public.event_rsvps FOR UPDATE
  USING (get_my_role() IN ('officer', 'admin'))
  WITH CHECK (get_my_role() IN ('officer', 'admin'));

CREATE POLICY officers_delete_event_rsvps
  ON public.event_rsvps FOR DELETE
  USING (get_my_role() IN ('officer', 'admin'));
