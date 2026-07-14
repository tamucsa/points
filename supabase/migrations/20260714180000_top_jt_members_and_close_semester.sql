-- Top N members per Jiating for the Jiatings leaderboard (avoids PostgREST max-rows truncation).
CREATE OR REPLACE FUNCTION public.top_leaderboard_members_per_jt(p_limit integer DEFAULT 3)
RETURNS TABLE (
  id uuid,
  full_name text,
  profile_image_url text,
  jt_family text,
  jt_color text,
  total_points smallint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    ranked.id,
    ranked.full_name,
    ranked.profile_image_url,
    ranked.jt_family,
    ranked.jt_color,
    ranked.total_points
  FROM (
    SELECT
      v.id,
      v.full_name,
      v.profile_image_url,
      v.jt_family,
      v.jt_color,
      v.total_points,
      row_number() OVER (
        PARTITION BY v.jt_family
        ORDER BY v.total_points DESC, v.full_name ASC
      ) AS rn
    FROM public.v_current_leaderboard v
    WHERE v.jt_family IS NOT NULL
  ) ranked
  WHERE ranked.rn <= GREATEST(COALESCE(p_limit, 3), 1);
$$;

COMMENT ON FUNCTION public.top_leaderboard_members_per_jt(integer) IS
  'Returns up to p_limit members per Jiating from v_current_leaderboard, ranked by total_points.';

REVOKE ALL ON FUNCTION public.top_leaderboard_members_per_jt(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.top_leaderboard_members_per_jt(integer) TO authenticated;

-- Capture close_semester in migrations (was live-only) and archive from member_semester_points.
CREATE OR REPLACE FUNCTION public.close_semester(p_semester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
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

  UPDATE public.semesters
  SET is_active = false
  WHERE id = p_semester_id;
END;
$$;

COMMENT ON FUNCTION public.close_semester(uuid) IS
  'Archives member_semester_points into semester_summaries and deactivates the semester. Call via service role after admin auth in app.';

REVOKE ALL ON FUNCTION public.close_semester(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_semester(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_semester(uuid) TO service_role;
