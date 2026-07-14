-- On Spring close (start month Jan–Jul), clear member Jiating assignments after
-- archiving summaries. Members stay active. Fall close leaves JTs unchanged.

CREATE OR REPLACE FUNCTION public.close_semester(p_semester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start_date date;
BEGIN
  SELECT start_date INTO v_start_date
  FROM public.semesters
  WHERE id = p_semester_id;

  IF v_start_date IS NULL THEN
    RAISE EXCEPTION 'Semester % not found', p_semester_id;
  END IF;

  INSERT INTO public.semester_summaries (
    member_id,
    semester_id,
    jt_family_id,
    jt_family_name,
    total_points,
    csa_points,
    jt_points,
    sports_points,
    gm_points
  )
  SELECT
    msp.member_id,
    p_semester_id,
    m.jt_family_id,
    f.name,
    msp.total_points,
    msp.csa_points,
    msp.jt_points,
    msp.sports_points,
    msp.gm_points
  FROM public.member_semester_points msp
  JOIN public.members m ON m.id = msp.member_id
  LEFT JOIN public.jt_families f ON f.id = m.jt_family_id
  WHERE msp.semester_id = p_semester_id
    AND m.status = 'active'
  ON CONFLICT (member_id, semester_id) DO UPDATE
    SET total_points   = EXCLUDED.total_points,
        csa_points     = EXCLUDED.csa_points,
        jt_points      = EXCLUDED.jt_points,
        sports_points  = EXCLUDED.sports_points,
        gm_points      = EXCLUDED.gm_points,
        jt_family_id   = EXCLUDED.jt_family_id,
        jt_family_name = EXCLUDED.jt_family_name;

  -- End of school year (Spring / start before August): clear live JT assignments.
  -- Archived jt_family_name in semester_summaries is preserved above.
  IF EXTRACT(MONTH FROM v_start_date) < 8 THEN
    UPDATE public.members
    SET jt_family_id = NULL
    WHERE jt_family_id IS NOT NULL
      AND status = 'active';
  END IF;

  UPDATE public.semesters
  SET is_active = false
  WHERE id = p_semester_id;
END;
$$;

COMMENT ON FUNCTION public.close_semester(uuid) IS
  'Archives member_semester_points into semester_summaries and deactivates the semester. For Spring (start month < 8), also clears members.jt_family_id while leaving status active. Call via service role after admin auth in app.';

REVOKE ALL ON FUNCTION public.close_semester(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_semester(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_semester(uuid) TO service_role;
