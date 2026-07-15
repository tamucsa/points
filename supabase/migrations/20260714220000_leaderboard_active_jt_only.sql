-- Overall leaderboard should only show current (active) Jiating names/colors.
-- Members still linked to deactivated prior-year families appear without a JT badge.

DROP VIEW IF EXISTS public.v_current_leaderboard;

CREATE VIEW public.v_current_leaderboard
WITH (security_invoker = true)
AS
SELECT
  m.id,
  m.full_name,
  m.email,
  m.profile_image_url,
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
