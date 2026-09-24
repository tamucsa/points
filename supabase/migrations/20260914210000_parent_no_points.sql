-- Parents never earn points. Attendance is still recorded. Public leaderboards
-- and Jiating standings exclude them. Officer member lists still include them.

CREATE OR REPLACE FUNCTION public.recompute_member_semester_points(p_member_id uuid, p_semester_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.member_role;
  v_total smallint;
  v_csa smallint;
  v_jt smallint;
  v_sports smallint;
  v_gm smallint;
BEGIN
  IF p_member_id IS NULL OR p_semester_id IS NULL THEN
    RETURN;
  END IF;

  SELECT m.role INTO v_role FROM public.members m WHERE m.id = p_member_id;

  IF v_role = 'parent'::public.member_role THEN
    v_total := 0;
    v_csa := 0;
    v_jt := 0;
    v_sports := 0;
    v_gm := 0;
  ELSE
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
  END IF;

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
  'Upserts counted point buckets for one member in one semester. Parents are always stored as 0.';

CREATE OR REPLACE FUNCTION public.members_recompute_points_on_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semester_id uuid;
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_semester_id FROM public.semesters WHERE is_active = true LIMIT 1;
  IF v_semester_id IS NOT NULL THEN
    PERFORM public.recompute_member_semester_points(NEW.id, v_semester_id);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.members_recompute_points_on_role_change() IS
  'Recomputes active-semester points when a member role changes (e.g. member ↔ parent).';

REVOKE ALL ON FUNCTION public.members_recompute_points_on_role_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS members_recompute_points_on_role_change ON public.members;
CREATE TRIGGER members_recompute_points_on_role_change
  AFTER UPDATE OF role ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.members_recompute_points_on_role_change();

DROP VIEW IF EXISTS public.v_current_leaderboard;

CREATE VIEW public.v_current_leaderboard
WITH (security_invoker = true)
AS
SELECT
  m.id,
  m.full_name,
  m.email,
  m.profile_image_url,
  m.role,
  (m.auth_uid IS NOT NULL) AS account_linked,
  jf.name AS jt_family,
  CASE
    WHEN jf.id IS NOT NULL THEN COALESCE(jf.color, '#4f6ef7')
    ELSE NULL
  END AS jt_color,
  COALESCE(msp.total_points, 0)::smallint AS total_points,
  COALESCE(msp.csa_points, 0)::smallint AS csa_points,
  COALESCE(msp.jt_points, 0)::smallint AS jt_points,
  COALESCE(msp.sports_points, 0)::smallint AS sports_points,
  COALESCE(msp.gm_points, 0)::smallint AS gm_points
FROM public.members m
JOIN public.semesters s ON s.is_active = true
LEFT JOIN public.jt_families jf
  ON jf.id = m.jt_family_id
 AND jf.is_active = true
LEFT JOIN public.member_semester_points msp
  ON msp.member_id = m.id AND msp.semester_id = s.id
WHERE m.status = 'active';

GRANT SELECT ON public.v_current_leaderboard TO authenticated;
REVOKE SELECT ON public.v_current_leaderboard FROM anon;

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
      AND v.role IS DISTINCT FROM 'parent'::public.member_role
  ) ranked
  WHERE ranked.rn <= GREATEST(COALESCE(p_limit, 3), 1);
$$;

COMMENT ON FUNCTION public.top_leaderboard_members_per_jt(integer) IS
  'Returns up to p_limit point-earning members per Jiating from v_current_leaderboard.';

REVOKE ALL ON FUNCTION public.top_leaderboard_members_per_jt(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.top_leaderboard_members_per_jt(integer) TO authenticated;

DROP VIEW IF EXISTS public.v_jt_leaderboard;

CREATE VIEW public.v_jt_leaderboard
WITH (security_invoker = true)
AS
SELECT
  jf.name AS jt_family,
  COALESCE(jf.color, '#4f6ef7') AS jt_color,
  COUNT(DISTINCT m.id) AS member_count,
  COALESCE(SUM(CASE WHEN a.counted THEN e.point_value ELSE 0 END), 0)::smallint AS total_points,
  ROUND(
    COALESCE(SUM(CASE WHEN a.counted THEN e.point_value ELSE 0 END), 0)::numeric
    / NULLIF(COUNT(DISTINCT m.id), 0),
    1
  ) AS avg_points_per_member
FROM public.jt_families jf
JOIN public.semesters s ON s.is_active = true
JOIN public.members m
  ON m.jt_family_id = jf.id
 AND m.status = 'active'
 AND m.role IS DISTINCT FROM 'parent'::public.member_role
LEFT JOIN public.attendance a ON a.member_id = m.id AND a.semester_id = s.id
LEFT JOIN public.events e ON e.id = a.event_id
WHERE jf.is_active = true
GROUP BY jf.id, jf.name, jf.color;

GRANT SELECT ON public.v_jt_leaderboard TO authenticated;
REVOKE SELECT ON public.v_jt_leaderboard FROM anon;
