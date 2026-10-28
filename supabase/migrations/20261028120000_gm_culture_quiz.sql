-- Culture Quiz placements for a General Meeting.
-- 1st is 3 points, 2nd is 2, 3rd is 1. A place can be shared.
-- Points are added on top of that meeting's check-in and count in the GM bucket.
-- Parents cannot earn them. Removing a check-in removes that member's place.

CREATE TABLE IF NOT EXISTS public.gm_culture_quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  semester_id uuid NOT NULL REFERENCES public.semesters (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  place smallint NOT NULL,
  points smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gm_culture_quiz_results_event_member_key UNIQUE (event_id, member_id),
  CONSTRAINT gm_culture_quiz_results_place_check CHECK (place IN (1, 2, 3)),
  CONSTRAINT gm_culture_quiz_results_points_match_place CHECK (
    points = CASE place
      WHEN 1 THEN 3
      WHEN 2 THEN 2
      WHEN 3 THEN 1
    END
  )
);

CREATE INDEX IF NOT EXISTS idx_gm_culture_quiz_results_member_semester
  ON public.gm_culture_quiz_results (member_id, semester_id);

COMMENT ON TABLE public.gm_culture_quiz_results IS
  'Culture Quiz places for a General Meeting. Points are 3 / 2 / 1 and can be shared. They add to GM points on top of check-in.';

CREATE OR REPLACE FUNCTION public.enforce_gm_culture_quiz_result()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_category text;
  v_semester uuid;
  v_parent boolean;
  v_attended boolean;
BEGIN
  SELECT category, semester_id
  INTO v_category, v_semester
  FROM public.events
  WHERE id = NEW.event_id;

  IF v_semester IS NULL THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;

  IF v_category IS DISTINCT FROM 'General Meeting' THEN
    RAISE EXCEPTION 'Culture Quiz results are only for General Meetings.';
  END IF;

  SELECT
    COALESCE(is_parent, false)
    OR role = 'parent'::public.member_role
  INTO v_parent
  FROM public.members
  WHERE id = NEW.member_id;

  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'Member not found.';
  END IF;

  IF v_parent THEN
    RAISE EXCEPTION 'Parents cannot earn Culture Quiz points.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.attendance
    WHERE event_id = NEW.event_id
      AND member_id = NEW.member_id
  )
  INTO v_attended;

  IF NOT v_attended THEN
    RAISE EXCEPTION 'Culture Quiz places must come from this meeting''s attendance list.';
  END IF;

  NEW.semester_id := v_semester;
  NEW.points := CASE NEW.place
    WHEN 1 THEN 3
    WHEN 2 THEN 2
    WHEN 3 THEN 1
    ELSE NULL
  END;

  IF NEW.points IS NULL THEN
    RAISE EXCEPTION 'Place must be 1st, 2nd, or 3rd.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gm_culture_quiz_results_enforce ON public.gm_culture_quiz_results;
CREATE TRIGGER gm_culture_quiz_results_enforce
  BEFORE INSERT OR UPDATE OF event_id, member_id, place
  ON public.gm_culture_quiz_results
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_gm_culture_quiz_result();

REVOKE ALL ON FUNCTION public.enforce_gm_culture_quiz_result() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_gm_culture_quiz_result() TO authenticated;

CREATE OR REPLACE FUNCTION public.culture_quiz_recompute_member_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_member_semester_points(OLD.member_id, OLD.semester_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       OLD.member_id IS DISTINCT FROM NEW.member_id
       OR OLD.semester_id IS DISTINCT FROM NEW.semester_id
     )
  THEN
    PERFORM public.recompute_member_semester_points(OLD.member_id, OLD.semester_id);
  END IF;

  PERFORM public.recompute_member_semester_points(NEW.member_id, NEW.semester_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gm_culture_quiz_results_recompute ON public.gm_culture_quiz_results;
CREATE TRIGGER gm_culture_quiz_results_recompute
  AFTER INSERT OR UPDATE OR DELETE
  ON public.gm_culture_quiz_results
  FOR EACH ROW
  EXECUTE FUNCTION public.culture_quiz_recompute_member_points();

REVOKE ALL ON FUNCTION public.culture_quiz_recompute_member_points() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.culture_quiz_recompute_member_points() TO authenticated;

CREATE OR REPLACE FUNCTION public.attendance_clear_culture_quiz()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.gm_culture_quiz_results
    WHERE event_id = OLD.event_id
      AND member_id = OLD.member_id;
    RETURN OLD;
  END IF;

  IF OLD.member_id IS DISTINCT FROM NEW.member_id
     OR OLD.event_id IS DISTINCT FROM NEW.event_id
  THEN
    DELETE FROM public.gm_culture_quiz_results
    WHERE event_id = OLD.event_id
      AND member_id = OLD.member_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_clear_culture_quiz ON public.attendance;
CREATE TRIGGER attendance_clear_culture_quiz
  AFTER DELETE OR UPDATE OF member_id, event_id
  ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.attendance_clear_culture_quiz();

REVOKE ALL ON FUNCTION public.attendance_clear_culture_quiz() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attendance_clear_culture_quiz() TO authenticated;

CREATE OR REPLACE FUNCTION public.recompute_member_semester_points(p_member_id uuid, p_semester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total smallint;
  v_csa smallint;
  v_jt smallint;
  v_sports smallint;
  v_gm smallint;
  v_quiz smallint;
BEGIN
  IF p_member_id IS NULL OR p_semester_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(CASE
      WHEN a.counted THEN COALESCE(a.point_value_override, e.point_value)
      ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND e.category IN (
        'CSA-Wide', 'CSA-Wide Mixers', 'Philanthropy', 'Concessions'
      )
      THEN COALESCE(a.point_value_override, e.point_value) ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND e.category IN ('Jiating Olympics', 'Jiating Event', 'Jiating Mixer', 'Mixer')
      THEN COALESCE(a.point_value_override, e.point_value) ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND (
        e.category ILIKE '%Sports%'
        OR e.category = 'Dance'
      ) THEN COALESCE(a.point_value_override, e.point_value) ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND e.category = 'General Meeting'
      THEN COALESCE(a.point_value_override, e.point_value) ELSE 0 END), 0)::smallint
  INTO v_total, v_csa, v_jt, v_sports, v_gm
  FROM public.attendance a
  JOIN public.events e ON e.id = a.event_id
  WHERE a.member_id = p_member_id
    AND a.semester_id = p_semester_id;

  SELECT COALESCE(SUM(q.points), 0)::smallint
  INTO v_quiz
  FROM public.gm_culture_quiz_results q
  JOIN public.members m ON m.id = q.member_id
  WHERE q.member_id = p_member_id
    AND q.semester_id = p_semester_id
    AND COALESCE(m.is_parent, false) = false
    AND m.role IS DISTINCT FROM 'parent'::public.member_role;

  v_total := (COALESCE(v_total, 0) + COALESCE(v_quiz, 0))::smallint;
  v_gm := (COALESCE(v_gm, 0) + COALESCE(v_quiz, 0))::smallint;

  INSERT INTO public.member_semester_points AS msp (
    member_id,
    semester_id,
    total_points,
    csa_points,
    jt_points,
    sports_points,
    gm_points,
    updated_at
  )
  VALUES (
    p_member_id,
    p_semester_id,
    COALESCE(v_total, 0),
    COALESCE(v_csa, 0),
    COALESCE(v_jt, 0),
    COALESCE(v_sports, 0),
    COALESCE(v_gm, 0),
    now()
  )
  ON CONFLICT (member_id, semester_id) DO UPDATE
  SET
    total_points = EXCLUDED.total_points,
    csa_points = EXCLUDED.csa_points,
    jt_points = EXCLUDED.jt_points,
    sports_points = EXCLUDED.sports_points,
    gm_points = EXCLUDED.gm_points,
    updated_at = EXCLUDED.updated_at;
END;
$function$;

COMMENT ON FUNCTION public.recompute_member_semester_points(uuid, uuid) IS
  'Upserts counted point buckets for one member in one semester, including Culture Quiz points in the GM bucket. Parents are stored the same way for attendance and stay off leaderboards. Culture Quiz rows for parents are ignored.';

CREATE OR REPLACE FUNCTION public.members_recompute_points_on_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semester_id uuid;
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role
     AND OLD.is_parent IS NOT DISTINCT FROM NEW.is_parent THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.is_parent, false)
     OR NEW.role = 'parent'::public.member_role
  THEN
    DELETE FROM public.gm_culture_quiz_results
    WHERE member_id = NEW.id;
  END IF;

  SELECT id INTO v_semester_id FROM public.semesters WHERE is_active = true LIMIT 1;
  IF v_semester_id IS NOT NULL THEN
    PERFORM public.recompute_member_semester_points(NEW.id, v_semester_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_gm_culture_quiz(
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
    RAISE EXCEPTION 'Culture Quiz results are only for General Meetings.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS row
    WHERE NULLIF(row->>'member_id', '') IS NOT NULL
    GROUP BY row->>'member_id'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'A member can only hold one Culture Quiz place.';
  END IF;

  DELETE FROM public.gm_culture_quiz_results
  WHERE event_id = p_event_id;

  INSERT INTO public.gm_culture_quiz_results (
    event_id,
    semester_id,
    member_id,
    place,
    points
  )
  SELECT
    p_event_id,
    v_semester,
    (row->>'member_id')::uuid,
    (row->>'place')::smallint,
    CASE (row->>'place')::smallint
      WHEN 1 THEN 3
      WHEN 2 THEN 2
      WHEN 3 THEN 1
      ELSE 0
    END
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS row
  WHERE NULLIF(row->>'member_id', '') IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_gm_culture_quiz(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_gm_culture_quiz(uuid, jsonb) TO authenticated;

CREATE OR REPLACE VIEW public.v_jt_leaderboard
WITH (security_invoker = true)
AS
SELECT
  base.jt_family,
  base.jt_color,
  base.member_count,
  (base.attendance_points + base.quiz_points)::smallint AS total_points,
  ROUND(
    (base.attendance_points + base.quiz_points)::numeric
    / NULLIF(base.member_count, 0),
    1
  ) AS avg_points_per_member
FROM (
  SELECT
    jf.name AS jt_family,
    COALESCE(jf.color, '#4f6ef7') AS jt_color,
    COUNT(DISTINCT m.id) AS member_count,
    COALESCE(SUM(CASE WHEN a.counted THEN e.point_value ELSE 0 END), 0) AS attendance_points,
    COALESCE((
      SELECT SUM(q.points)
      FROM public.gm_culture_quiz_results q
      JOIN public.members mq ON mq.id = q.member_id
      WHERE mq.jt_family_id = jf.id
        AND q.semester_id = s.id
        AND mq.status = 'active'
        AND COALESCE(mq.is_parent, false) = false
        AND mq.role IS DISTINCT FROM 'parent'::public.member_role
    ), 0) AS quiz_points
  FROM public.jt_families jf
  JOIN public.semesters s ON s.is_active = true
  JOIN public.members m
    ON m.jt_family_id = jf.id
   AND m.status = 'active'
   AND COALESCE(m.is_parent, false) = false
   AND m.role IS DISTINCT FROM 'parent'::public.member_role
  LEFT JOIN public.attendance a ON a.member_id = m.id AND a.semester_id = s.id
  LEFT JOIN public.events e ON e.id = a.event_id
  WHERE jf.is_active = true
  GROUP BY jf.id, jf.name, jf.color, s.id
) base;

GRANT SELECT ON public.v_jt_leaderboard TO authenticated;
REVOKE SELECT ON public.v_jt_leaderboard FROM anon;

ALTER TABLE public.gm_culture_quiz_results ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.gm_culture_quiz_results FROM PUBLIC;
REVOKE ALL ON TABLE public.gm_culture_quiz_results FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.gm_culture_quiz_results TO authenticated;
GRANT ALL ON TABLE public.gm_culture_quiz_results TO service_role;

DROP POLICY IF EXISTS officers_read_gm_culture_quiz_results ON public.gm_culture_quiz_results;
CREATE POLICY officers_read_gm_culture_quiz_results
  ON public.gm_culture_quiz_results
  FOR SELECT
  TO authenticated
  USING (public.is_officer_or_parent());

DROP POLICY IF EXISTS officers_insert_gm_culture_quiz_results ON public.gm_culture_quiz_results;
CREATE POLICY officers_insert_gm_culture_quiz_results
  ON public.gm_culture_quiz_results
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_officer_or_parent());

DROP POLICY IF EXISTS officers_update_gm_culture_quiz_results ON public.gm_culture_quiz_results;
CREATE POLICY officers_update_gm_culture_quiz_results
  ON public.gm_culture_quiz_results
  FOR UPDATE
  TO authenticated
  USING (public.is_officer_or_parent())
  WITH CHECK (public.is_officer_or_parent());

DROP POLICY IF EXISTS officers_delete_gm_culture_quiz_results ON public.gm_culture_quiz_results;
CREATE POLICY officers_delete_gm_culture_quiz_results
  ON public.gm_culture_quiz_results
  FOR DELETE
  TO authenticated
  USING (public.is_officer_or_parent());

DROP POLICY IF EXISTS members_read_own_gm_culture_quiz_results ON public.gm_culture_quiz_results;
CREATE POLICY members_read_own_gm_culture_quiz_results
  ON public.gm_culture_quiz_results
  FOR SELECT
  TO authenticated
  USING (
    member_id = (
      SELECT m.id
      FROM public.members m
      WHERE m.auth_uid = auth.uid()
      LIMIT 1
    )
  );
