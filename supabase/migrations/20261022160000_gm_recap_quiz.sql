-- GM recap quizzes: credit for a General Meeting without attendance points.
-- Rows live here, not in attendance, so leaderboard totals stay unchanged.
-- The same meeting still counts once if the member also checked in.

CREATE TABLE IF NOT EXISTS public.gm_recap_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  semester_id uuid NOT NULL REFERENCES public.semesters (id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  member_id uuid REFERENCES public.members (id) ON DELETE SET NULL,
  is_guest boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gm_recap_submissions_event_email_key UNIQUE (event_id, email)
);

CREATE UNIQUE INDEX IF NOT EXISTS gm_recap_submissions_event_member_key
  ON public.gm_recap_submissions (event_id, member_id)
  WHERE member_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gm_recap_submissions_semester_member
  ON public.gm_recap_submissions (semester_id, member_id)
  WHERE member_id IS NOT NULL AND is_guest = false;

CREATE INDEX IF NOT EXISTS idx_gm_recap_submissions_unmatched
  ON public.gm_recap_submissions (event_id)
  WHERE member_id IS NULL AND is_guest = false;

COMMENT ON TABLE public.gm_recap_submissions IS
  'General Meeting recap quiz responses. A matched row is GM credit and awards no points.';

CREATE OR REPLACE FUNCTION public.enforce_gm_recap_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_category text;
  v_semester uuid;
BEGIN
  SELECT category, semester_id
  INTO v_category, v_semester
  FROM public.events
  WHERE id = NEW.event_id;

  IF v_semester IS NULL THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;

  IF v_category IS DISTINCT FROM 'General Meeting' THEN
    RAISE EXCEPTION 'Recap quizzes are only for General Meetings.';
  END IF;

  NEW.semester_id := v_semester;
  NEW.email := lower(trim(NEW.email));
  IF NEW.email = '' THEN
    RAISE EXCEPTION 'Email is required.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gm_recap_submissions_enforce ON public.gm_recap_submissions;
CREATE TRIGGER gm_recap_submissions_enforce
  BEFORE INSERT OR UPDATE OF event_id, email
  ON public.gm_recap_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_gm_recap_submission();

REVOKE ALL ON FUNCTION public.enforce_gm_recap_submission() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_gm_recap_submission() TO authenticated;

ALTER TABLE public.gm_recap_submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.gm_recap_submissions FROM PUBLIC;
REVOKE ALL ON TABLE public.gm_recap_submissions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gm_recap_submissions TO authenticated;
GRANT ALL ON TABLE public.gm_recap_submissions TO service_role;

DROP POLICY IF EXISTS officers_read_gm_recap_submissions ON public.gm_recap_submissions;
CREATE POLICY officers_read_gm_recap_submissions
  ON public.gm_recap_submissions
  FOR SELECT
  TO authenticated
  USING (public.is_officer_or_parent());

DROP POLICY IF EXISTS officers_insert_gm_recap_submissions ON public.gm_recap_submissions;
CREATE POLICY officers_insert_gm_recap_submissions
  ON public.gm_recap_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_officer_or_parent());

DROP POLICY IF EXISTS officers_update_gm_recap_submissions ON public.gm_recap_submissions;
CREATE POLICY officers_update_gm_recap_submissions
  ON public.gm_recap_submissions
  FOR UPDATE
  TO authenticated
  USING (public.is_officer_or_parent())
  WITH CHECK (public.is_officer_or_parent());

DROP POLICY IF EXISTS officers_delete_gm_recap_submissions ON public.gm_recap_submissions;
CREATE POLICY officers_delete_gm_recap_submissions
  ON public.gm_recap_submissions
  FOR DELETE
  TO authenticated
  USING (public.is_officer_or_parent());

DROP POLICY IF EXISTS members_read_own_gm_recap_submissions ON public.gm_recap_submissions;
CREATE POLICY members_read_own_gm_recap_submissions
  ON public.gm_recap_submissions
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

-- Atomic replace so a failed upload cannot leave a half-applied quiz list.
CREATE OR REPLACE FUNCTION public.replace_gm_recap_quiz(
  p_event_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_category text;
  v_semester uuid;
BEGIN
  IF NOT public.is_officer_or_parent() THEN
    RAISE EXCEPTION 'Officer access required.';
  END IF;

  SELECT category, semester_id
  INTO v_category, v_semester
  FROM public.events
  WHERE id = p_event_id;

  IF v_semester IS NULL THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;

  IF v_category IS DISTINCT FROM 'General Meeting' THEN
    RAISE EXCEPTION 'Recap quizzes are only for General Meetings.';
  END IF;

  DELETE FROM public.gm_recap_submissions
  WHERE event_id = p_event_id;

  INSERT INTO public.gm_recap_submissions (
    event_id,
    semester_id,
    email,
    full_name,
    member_id,
    is_guest
  )
  SELECT
    p_event_id,
    v_semester,
    lower(trim(row->>'email')),
    NULLIF(trim(COALESCE(row->>'full_name', '')), ''),
    NULLIF(row->>'member_id', '')::uuid,
    false
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS row
  WHERE length(trim(COALESCE(row->>'email', ''))) > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_gm_recap_quiz(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_gm_recap_quiz(uuid, jsonb) TO authenticated;
