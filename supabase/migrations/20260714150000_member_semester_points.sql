-- Precomputed per-member semester point totals for leaderboard / member list reads.
-- Refreshed on attendance insert/delete/counted updates and event point_value/category changes.

CREATE TABLE IF NOT EXISTS public.member_semester_points (
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  semester_id uuid NOT NULL REFERENCES public.semesters (id) ON DELETE CASCADE,
  total_points smallint NOT NULL DEFAULT 0,
  csa_points smallint NOT NULL DEFAULT 0,
  jt_points smallint NOT NULL DEFAULT 0,
  sports_points smallint NOT NULL DEFAULT 0,
  gm_points smallint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, semester_id)
);

CREATE INDEX IF NOT EXISTS idx_member_semester_points_semester_total
  ON public.member_semester_points (semester_id, total_points DESC);

COMMENT ON TABLE public.member_semester_points IS
  'Cached counted point totals per member per semester; source for v_current_leaderboard.';

ALTER TABLE public.member_semester_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read member semester points"
  ON public.member_semester_points
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.member_semester_points FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.member_semester_points TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.recompute_member_semester_points(
  p_member_id uuid,
  p_semester_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total smallint;
  v_csa smallint;
  v_jt smallint;
  v_sports smallint;
  v_gm smallint;
BEGIN
  IF p_member_id IS NULL OR p_semester_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN a.counted THEN e.point_value ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND e.category IN ('CSA-Wide', 'Philanthropy', 'Concessions')
      THEN e.point_value ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND e.category IN ('Jiating Olympics', 'Jiating Event', 'Mixer')
      THEN e.point_value ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND (
        e.category ILIKE '%Sports%'
        OR e.category = 'Dance'
      ) THEN e.point_value ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND e.category = 'General Meeting' THEN e.point_value ELSE 0 END), 0)::smallint
  INTO v_total, v_csa, v_jt, v_sports, v_gm
  FROM public.attendance a
  JOIN public.events e ON e.id = a.event_id
  WHERE a.member_id = p_member_id
    AND a.semester_id = p_semester_id;

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
$$;

COMMENT ON FUNCTION public.recompute_member_semester_points(uuid, uuid) IS
  'Upserts counted point buckets for one member in one semester.';

REVOKE ALL ON FUNCTION public.recompute_member_semester_points(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_member_semester_points(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.attendance_recompute_member_semester_points()
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

  PERFORM public.recompute_member_semester_points(NEW.member_id, NEW.semester_id);

  IF TG_OP = 'UPDATE'
     AND (
       OLD.member_id IS DISTINCT FROM NEW.member_id
       OR OLD.semester_id IS DISTINCT FROM NEW.semester_id
     )
  THEN
    PERFORM public.recompute_member_semester_points(OLD.member_id, OLD.semester_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_recompute_member_semester_points ON public.attendance;
CREATE TRIGGER attendance_recompute_member_semester_points
  AFTER INSERT OR DELETE OR UPDATE OF counted, member_id, semester_id, event_id
  ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.attendance_recompute_member_semester_points();

CREATE OR REPLACE FUNCTION public.events_recompute_member_semester_points()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF OLD.point_value IS NOT DISTINCT FROM NEW.point_value
     AND OLD.category IS NOT DISTINCT FROM NEW.category THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT a.member_id, a.semester_id
    FROM public.attendance a
    WHERE a.event_id = NEW.id
  LOOP
    PERFORM public.recompute_member_semester_points(r.member_id, r.semester_id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_recompute_member_semester_points ON public.events;
CREATE TRIGGER events_recompute_member_semester_points
  AFTER UPDATE OF point_value, category ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_recompute_member_semester_points();

DROP VIEW IF EXISTS public.v_current_leaderboard;

CREATE VIEW public.v_current_leaderboard AS
SELECT
  m.id,
  m.full_name,
  m.email,
  m.profile_image_url,
  (m.auth_uid IS NOT NULL) AS account_linked,
  jf.name AS jt_family,
  COALESCE(jf.color, '#4f6ef7') AS jt_color,
  COALESCE(msp.total_points, 0)::smallint AS total_points,
  COALESCE(msp.csa_points, 0)::smallint AS csa_points,
  COALESCE(msp.jt_points, 0)::smallint AS jt_points,
  COALESCE(msp.sports_points, 0)::smallint AS sports_points,
  COALESCE(msp.gm_points, 0)::smallint AS gm_points
FROM public.members m
JOIN public.semesters s ON s.is_active = true
LEFT JOIN public.jt_families jf ON jf.id = m.jt_family_id
LEFT JOIN public.member_semester_points msp
  ON msp.member_id = m.id AND msp.semester_id = s.id
WHERE m.status = 'active';

GRANT SELECT ON public.v_current_leaderboard TO anon, authenticated;

-- Backfill active semester (all active members + anyone with attendance)
DO $$
DECLARE
  r RECORD;
  v_semester_id uuid;
BEGIN
  SELECT id INTO v_semester_id FROM public.semesters WHERE is_active = true LIMIT 1;
  IF v_semester_id IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT m.id AS member_id
    FROM public.members m
    WHERE m.status = 'active'
    UNION
    SELECT DISTINCT a.member_id
    FROM public.attendance a
    WHERE a.semester_id = v_semester_id
  LOOP
    PERFORM public.recompute_member_semester_points(r.member_id, v_semester_id);
  END LOOP;
END;
$$;
