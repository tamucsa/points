-- Drop preferred_name; full_name is the single source of truth for member names.

DROP VIEW IF EXISTS public.v_current_leaderboard;

CREATE VIEW public.v_current_leaderboard AS
SELECT
  m.id,
  m.full_name,
  m.email,
  m.profile_image_url,
  jf.name AS jt_family,
  COALESCE(jf.color, '#4f6ef7') AS jt_color,
  COALESCE(SUM(CASE WHEN a.counted THEN e.point_value ELSE 0 END), 0)::smallint AS total_points,
  COALESCE(SUM(CASE WHEN a.counted AND e.category ILIKE '%CSA%' THEN e.point_value ELSE 0 END), 0)::smallint AS csa_points,
  COALESCE(SUM(CASE WHEN a.counted AND e.category ILIKE '%JT%' THEN e.point_value ELSE 0 END), 0)::smallint AS jt_points,
  COALESCE(SUM(CASE WHEN a.counted AND e.category ILIKE '%Sports%' THEN e.point_value ELSE 0 END), 0)::smallint AS sports_points,
  COALESCE(SUM(CASE WHEN a.counted AND e.category = 'GM' THEN e.point_value ELSE 0 END), 0)::smallint AS gm_points
FROM public.members m
JOIN public.semesters s ON s.is_active = true
LEFT JOIN public.jt_families jf ON jf.id = m.jt_family_id
LEFT JOIN public.attendance a ON a.member_id = m.id AND a.semester_id = s.id
LEFT JOIN public.events e ON e.id = a.event_id
WHERE m.status = 'active'
GROUP BY m.id, m.full_name, m.email, m.profile_image_url, jf.name, jf.color;

GRANT SELECT ON public.v_current_leaderboard TO anon, authenticated;

ALTER TABLE public.members DROP COLUMN IF EXISTS preferred_name;
