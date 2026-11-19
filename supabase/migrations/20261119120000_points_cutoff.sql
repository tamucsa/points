-- Points cutoff per semester, with per-event admin exceptions.
--
--   * semesters.points_cutoff_at: events that START at or after this time earn no
--     points. NULL = no cutoff. Attendance is still recorded.
--   * events.points_exception: NULL = follow the cutoff, 'always' = earns points
--     even after the cutoff, 'never' = earns no points even before it. Admin only.
--   * Culture Quiz points follow their General Meeting's start time.
--
-- One rule (event_earns_points) is used by member totals, the Jiatings family
-- totals and the weekly JT / spectator caps, so they cannot drift apart.
--
-- Also fixes v_jt_leaderboard: it re-summed events.point_value and ignored
-- attendance.point_value_override, so manual-points awards never reached family
-- totals. It now sums the cached member_semester_points instead.

-- ========== Columns ==========
ALTER TABLE public.semesters
  ADD COLUMN IF NOT EXISTS points_cutoff_at timestamptz;

COMMENT ON COLUMN public.semesters.points_cutoff_at IS
  'Events starting at or after this time earn no points (unless the event is marked always). NULL = no cutoff.';

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS points_exception text;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_points_exception_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_points_exception_check
  CHECK (points_exception IS NULL OR points_exception IN ('always', 'never'));

COMMENT ON COLUMN public.events.points_exception IS
  'NULL = follow the semester points cutoff; always = earns points even after the cutoff; never = earns no points. Admin only.';

-- ========== The rule ==========
CREATE OR REPLACE FUNCTION public.event_earns_points(
  p_starts_at timestamptz,
  p_points_exception text,
  p_points_cutoff_at timestamptz
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE p_points_exception
    WHEN 'always' THEN true
    WHEN 'never' THEN false
    ELSE p_points_cutoff_at IS NULL OR p_starts_at < p_points_cutoff_at
  END;
$$;

COMMENT ON FUNCTION public.event_earns_points(timestamptz, text, timestamptz) IS
  'True when an event earns points: exception always/never wins, otherwise the event must start before the semester points cutoff (if any). Mirrored in src/utils/points-cutoff.ts.';

GRANT EXECUTE ON FUNCTION public.event_earns_points(timestamptz, text, timestamptz) TO authenticated;

-- ========== Only admins may set an exception ==========
CREATE OR REPLACE FUNCTION public.events_guard_points_exception()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.points_exception IS NOT DISTINCT FROM OLD.points_exception THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' AND NEW.points_exception IS NULL THEN
    RETURN NEW;
  END IF;

  -- Service role / server-side admin client has no auth.uid().
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_uid = auth.uid()
      AND m.role = 'admin'::public.member_role
  ) THEN
    RAISE EXCEPTION 'Only admins can change an event''s points exception.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_guard_points_exception ON public.events;
CREATE TRIGGER events_guard_points_exception
  BEFORE INSERT OR UPDATE OF points_exception ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_guard_points_exception();

-- ========== Member totals ==========
CREATE OR REPLACE FUNCTION public.recompute_member_semester_points(p_member_id uuid, p_semester_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cutoff timestamptz;
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

  SELECT s.points_cutoff_at INTO v_cutoff
  FROM public.semesters s
  WHERE s.id = p_semester_id;

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
        OR e.category IN ('Dance', 'Dance Practice', 'Dance Performance', 'Dance Spectator')
      ) THEN COALESCE(a.point_value_override, e.point_value) ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND e.category = 'General Meeting'
      THEN COALESCE(a.point_value_override, e.point_value) ELSE 0 END), 0)::smallint
  INTO v_total, v_csa, v_jt, v_sports, v_gm
  FROM public.attendance a
  JOIN public.events e ON e.id = a.event_id
  WHERE a.member_id = p_member_id
    AND a.semester_id = p_semester_id
    AND public.event_earns_points(e.starts_at, e.points_exception, v_cutoff);

  SELECT COALESCE(SUM(q.points), 0)::smallint
  INTO v_quiz
  FROM public.gm_culture_quiz_results q
  JOIN public.members m ON m.id = q.member_id
  JOIN public.events e ON e.id = q.event_id
  WHERE q.member_id = p_member_id
    AND q.semester_id = p_semester_id
    AND COALESCE(m.is_parent, false) = false
    AND m.role IS DISTINCT FROM 'parent'::public.member_role
    AND public.event_earns_points(e.starts_at, e.points_exception, v_cutoff);

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
  'Upserts counted point buckets for one member in one semester, including Culture Quiz points in the GM bucket. Only events that pass event_earns_points (semester cutoff + admin exception) count. Sports & Dance = Sports, Sports Spectator, Dance Practice, Dance Performance, Dance Spectator. Culture Quiz rows for parents are ignored.';

REVOKE ALL ON FUNCTION public.recompute_member_semester_points(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ========== Caps: point-earning attendance gets the slots first ==========
-- Without this, a zero-point event after the cutoff could take one of the 4 weekly
-- JT slots (or spectator room) and push out an earlier event that should count.
CREATE OR REPLACE FUNCTION public.recompute_member_jt_week_cap(p_member_id uuid, p_week_start date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_member_id IS NULL OR p_week_start IS NULL THEN
    RETURN;
  END IF;

  WITH ranked AS (
    SELECT
      a.id,
      ROW_NUMBER() OVER (
        ORDER BY public.event_earns_points(e.starts_at, e.points_exception, s.points_cutoff_at) DESC,
                 COALESCE(a.point_value_override, e.point_value) DESC,
                 e.starts_at ASC,
                 a.id ASC
      ) AS rn
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    LEFT JOIN public.semesters s ON s.id = a.semester_id
    WHERE a.member_id = p_member_id
      AND e.category IN ('Jiating Event', 'Jiating Mixer', 'Mixer')
      AND e.starts_at >= (p_week_start::timestamp AT TIME ZONE 'America/Chicago')
      AND e.starts_at < ((p_week_start + 7)::timestamp AT TIME ZONE 'America/Chicago')
  )
  UPDATE public.attendance AS a
  SET counted = (r.rn <= 4)
  FROM ranked r
  WHERE a.id = r.id
    AND a.counted IS DISTINCT FROM (r.rn <= 4);
END;
$function$;

COMMENT ON FUNCTION public.recompute_member_jt_week_cap(uuid, date) IS
  'Sets counted for Jiating Event/Mixer attendances in a Chicago Mon–Sun week: top 4, point-earning events first, then by points and start time.';

CREATE OR REPLACE FUNCTION public.recompute_member_spectator_semester_cap(
  p_member_id uuid,
  p_semester_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz;
BEGIN
  IF p_member_id IS NULL OR p_semester_id IS NULL THEN
    RETURN;
  END IF;

  SELECT s.points_cutoff_at INTO v_cutoff
  FROM public.semesters s
  WHERE s.id = p_semester_id;

  WITH base AS (
    SELECT
      a.id,
      a.recorded_at,
      COALESCE(a.point_value_override, e.point_value) AS pts,
      public.event_earns_points(e.starts_at, e.points_exception, v_cutoff) AS earns
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    WHERE a.member_id = p_member_id
      AND a.semester_id = p_semester_id
      AND e.category = 'Sports Spectator'
  ),
  ranked AS (
    SELECT
      b.id,
      SUM(CASE WHEN b.earns THEN b.pts ELSE 0 END) OVER (
        ORDER BY b.earns DESC, b.recorded_at ASC, b.id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS cum_points
    FROM base b
  )
  UPDATE public.attendance AS a
  SET counted = (r.cum_points <= 10)
  FROM ranked r
  WHERE a.id = r.id
    AND a.counted IS DISTINCT FROM (r.cum_points <= 10);
END;
$$;

-- ========== Recompute when an event's start time or exception changes ==========
CREATE OR REPLACE FUNCTION public.events_recompute_points_cutoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_jt boolean;
BEGIN
  IF OLD.starts_at IS NOT DISTINCT FROM NEW.starts_at
     AND OLD.points_exception IS NOT DISTINCT FROM NEW.points_exception THEN
    RETURN NEW;
  END IF;

  v_jt := NEW.category IN ('Jiating Event', 'Jiating Mixer', 'Mixer');

  FOR r IN
    SELECT DISTINCT a.member_id, a.semester_id
    FROM public.attendance a
    WHERE a.event_id = NEW.id
  LOOP
    -- starts_at changes are already handled by events_recompute_jt_week_cap.
    IF v_jt AND OLD.points_exception IS DISTINCT FROM NEW.points_exception THEN
      PERFORM public.recompute_member_jt_week_cap(
        r.member_id,
        public.chicago_week_start(NEW.starts_at)
      );
    END IF;
    IF NEW.category = 'Sports Spectator' THEN
      PERFORM public.recompute_member_spectator_semester_cap(r.member_id, r.semester_id);
    END IF;
    PERFORM public.recompute_member_semester_points(r.member_id, r.semester_id);
  END LOOP;

  -- Culture Quiz winners are always on attendance, but recompute any stragglers.
  FOR r IN
    SELECT DISTINCT q.member_id, q.semester_id
    FROM public.gm_culture_quiz_results q
    WHERE q.event_id = NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM public.attendance a
        WHERE a.event_id = NEW.id AND a.member_id = q.member_id
      )
  LOOP
    PERFORM public.recompute_member_semester_points(r.member_id, r.semester_id);
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.events_recompute_points_cutoff() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS events_recompute_points_cutoff ON public.events;
CREATE TRIGGER events_recompute_points_cutoff
  AFTER UPDATE OF starts_at, points_exception ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_recompute_points_cutoff();

-- ========== Recompute the whole semester when its cutoff changes ==========
CREATE OR REPLACE FUNCTION public.semesters_recompute_points_cutoff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  IF OLD.points_cutoff_at IS NOT DISTINCT FROM NEW.points_cutoff_at THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT DISTINCT a.member_id, public.chicago_week_start(e.starts_at) AS week_start
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    WHERE a.semester_id = NEW.id
      AND e.category IN ('Jiating Event', 'Jiating Mixer', 'Mixer')
  LOOP
    PERFORM public.recompute_member_jt_week_cap(r.member_id, r.week_start);
  END LOOP;

  FOR r IN
    SELECT DISTINCT a.member_id
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    WHERE a.semester_id = NEW.id
      AND e.category = 'Sports Spectator'
  LOOP
    PERFORM public.recompute_member_spectator_semester_cap(r.member_id, NEW.id);
  END LOOP;

  FOR r IN
    SELECT a.member_id FROM public.attendance a WHERE a.semester_id = NEW.id
    UNION
    SELECT q.member_id FROM public.gm_culture_quiz_results q WHERE q.semester_id = NEW.id
    UNION
    SELECT msp.member_id FROM public.member_semester_points msp WHERE msp.semester_id = NEW.id
  LOOP
    PERFORM public.recompute_member_semester_points(r.member_id, NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.semesters_recompute_points_cutoff() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS semesters_recompute_points_cutoff ON public.semesters;
CREATE TRIGGER semesters_recompute_points_cutoff
  AFTER UPDATE OF points_cutoff_at ON public.semesters
  FOR EACH ROW
  EXECUTE FUNCTION public.semesters_recompute_points_cutoff();

-- ========== Jiatings family totals: sum the cached member totals ==========
-- Same members as before (active, non-parent, in an active family; officers and
-- admins still add to their family). Overrides, caps, Culture Quiz and the cutoff
-- now all come from member_semester_points.
CREATE OR REPLACE VIEW public.v_jt_leaderboard
WITH (security_invoker = true)
AS
SELECT
  base.jt_family,
  base.jt_color,
  base.member_count,
  base.total_points::smallint AS total_points,
  ROUND(
    base.total_points::numeric / NULLIF(base.member_count, 0),
    1
  ) AS avg_points_per_member
FROM (
  SELECT
    jf.name AS jt_family,
    COALESCE(jf.color, '#4f6ef7') AS jt_color,
    COUNT(DISTINCT m.id) AS member_count,
    COALESCE(SUM(msp.total_points), 0) AS total_points
  FROM public.jt_families jf
  JOIN public.semesters s ON s.is_active = true
  JOIN public.members m
    ON m.jt_family_id = jf.id
   AND m.status = 'active'
   AND COALESCE(m.is_parent, false) = false
   AND m.role IS DISTINCT FROM 'parent'::public.member_role
  LEFT JOIN public.member_semester_points msp
    ON msp.member_id = m.id
   AND msp.semester_id = s.id
  WHERE jf.is_active = true
  GROUP BY jf.id, jf.name, jf.color, s.id
) base;

GRANT SELECT ON public.v_jt_leaderboard TO authenticated;
REVOKE SELECT ON public.v_jt_leaderboard FROM anon;
