-- Howdy Week prospective attendance: event_guests table + atomic replace RPC.
-- Guests are email-keyed attendees (not members yet); no attendance/points writes.

CREATE TABLE IF NOT EXISTS public.event_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  semester_id uuid NOT NULL REFERENCES public.semesters (id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  graduation_year integer,
  member_id uuid REFERENCES public.members (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_guests_event_email_key UNIQUE (event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_event_guests_event_id
  ON public.event_guests (event_id);

CREATE INDEX IF NOT EXISTS idx_event_guests_semester_member
  ON public.event_guests (semester_id, member_id)
  WHERE member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_guests_member_id
  ON public.event_guests (member_id)
  WHERE member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_guests_unmatched
  ON public.event_guests (event_id)
  WHERE member_id IS NULL;

COMMENT ON TABLE public.event_guests IS
  'Prospective / Howdy Week attendance by email; linkable to members on register or officer rematch.';

ALTER TABLE public.event_guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS officers_read_event_guests ON public.event_guests;
CREATE POLICY officers_read_event_guests
  ON public.event_guests FOR SELECT
  USING (get_my_role() IN ('officer', 'admin'));

DROP POLICY IF EXISTS officers_insert_event_guests ON public.event_guests;
CREATE POLICY officers_insert_event_guests
  ON public.event_guests FOR INSERT
  WITH CHECK (get_my_role() IN ('officer', 'admin'));

DROP POLICY IF EXISTS officers_update_event_guests ON public.event_guests;
CREATE POLICY officers_update_event_guests
  ON public.event_guests FOR UPDATE
  USING (get_my_role() IN ('officer', 'admin'))
  WITH CHECK (get_my_role() IN ('officer', 'admin'));

DROP POLICY IF EXISTS officers_delete_event_guests ON public.event_guests;
CREATE POLICY officers_delete_event_guests
  ON public.event_guests FOR DELETE
  USING (get_my_role() IN ('officer', 'admin'));

-- Members may claim unmatched guest rows that match their email (auto-link on register).
DROP POLICY IF EXISTS members_claim_own_event_guests ON public.event_guests;
CREATE POLICY members_claim_own_event_guests
  ON public.event_guests FOR UPDATE
  USING (
    member_id IS NULL
    AND lower(email) = (
      SELECT lower(m.email) FROM public.members m
      WHERE m.auth_uid = auth.uid()
      LIMIT 1
    )
  )
  WITH CHECK (
    member_id = (
      SELECT m.id FROM public.members m
      WHERE m.auth_uid = auth.uid()
      LIMIT 1
    )
  );

-- Members may read guest rows linked to them (badge on /pending).
DROP POLICY IF EXISTS members_read_own_event_guests ON public.event_guests;
CREATE POLICY members_read_own_event_guests
  ON public.event_guests FOR SELECT
  USING (
    member_id = (
      SELECT m.id FROM public.members m
      WHERE m.auth_uid = auth.uid()
      LIMIT 1
    )
  );

-- Atomic replace: wipe guests for event, then insert new rows (no attendance).
CREATE OR REPLACE FUNCTION public.replace_event_guests(
  p_event_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_officer boolean;
  v_semester_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_uid = auth.uid()
      AND m.role IN ('officer', 'admin')
      AND m.status = 'active'::member_status
  ) INTO v_is_officer;

  IF NOT v_is_officer THEN
    RAISE EXCEPTION 'Officer access required.';
  END IF;

  SELECT e.semester_id INTO v_semester_id
  FROM public.events e
  WHERE e.id = p_event_id;

  IF v_semester_id IS NULL THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;

  DELETE FROM public.event_guests WHERE event_id = p_event_id;

  INSERT INTO public.event_guests (
    event_id, semester_id, email, full_name, graduation_year, member_id
  )
  SELECT
    p_event_id,
    v_semester_id,
    lower(trim(row->>'email')),
    NULLIF(row->>'full_name', ''),
    (row->>'graduation_year')::integer,
    (row->>'member_id')::uuid
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS row;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_event_guests(uuid, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.replace_event_guests(uuid, jsonb) TO authenticated;
