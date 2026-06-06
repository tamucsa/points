ALTER TABLE public.jt_families
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#4f6ef7';

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS counted boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.set_attendance_counted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_category text;
  v_point_value smallint;
  v_existing_spectator_points integer;
BEGIN
  SELECT e.category, e.point_value
  INTO v_category, v_point_value
  FROM public.events e
  WHERE e.id = NEW.event_id;

  IF v_category = 'Sports Spectator' THEN
    SELECT COALESCE(SUM(e.point_value), 0)
    INTO v_existing_spectator_points
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    WHERE a.member_id = NEW.member_id
      AND a.semester_id = NEW.semester_id
      AND a.counted = true
      AND e.category = 'Sports Spectator';

    IF v_existing_spectator_points + v_point_value > 10 THEN
      NEW.counted := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_set_counted ON public.attendance;
CREATE TRIGGER attendance_set_counted
  BEFORE INSERT ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.set_attendance_counted();

CREATE OR REPLACE VIEW public.v_current_leaderboard AS
SELECT
  m.id,
  m.full_name,
  m.preferred_name,
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
GROUP BY m.id, m.full_name, m.preferred_name, m.email, m.profile_image_url, jf.name, jf.color;

CREATE OR REPLACE VIEW public.v_jt_leaderboard AS
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
JOIN public.members m ON m.jt_family_id = jf.id AND m.status = 'active'
LEFT JOIN public.attendance a ON a.member_id = m.id AND a.semester_id = s.id
LEFT JOIN public.events e ON e.id = a.event_id
WHERE jf.is_active = true
GROUP BY jf.id, jf.name, jf.color;

GRANT SELECT ON public.v_current_leaderboard TO anon, authenticated;
GRANT SELECT ON public.v_jt_leaderboard TO anon, authenticated;
