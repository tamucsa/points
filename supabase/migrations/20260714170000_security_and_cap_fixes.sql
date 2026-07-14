-- Critical audit fixes: tighten members/attendance RLS, revoke dangerous grants,
-- Spectator semester recompute, JT category/point_value edge cases.

-- ========== Members RLS: freeze privileged columns on self-update ==========
DROP POLICY IF EXISTS "Members can update own profile" ON public.members;
CREATE POLICY "Members can update own profile"
  ON public.members
  FOR UPDATE
  USING (auth_uid = auth.uid())
  WITH CHECK (
    auth_uid = auth.uid()
    AND role = (SELECT m.role FROM public.members m WHERE m.id = members.id)
    AND status = (SELECT m.status FROM public.members m WHERE m.id = members.id)
    AND NOT (jt_family_id IS DISTINCT FROM (SELECT m.jt_family_id FROM public.members m WHERE m.id = members.id))
    AND NOT (auth_uid IS DISTINCT FROM (SELECT m.auth_uid FROM public.members m WHERE m.id = members.id))
    AND NOT (email IS DISTINCT FROM (SELECT m.email FROM public.members m WHERE m.id = members.id))
  );

DROP POLICY IF EXISTS "Anyone can insert own member row on registration" ON public.members;
CREATE POLICY "Anyone can insert own member row on registration"
  ON public.members
  FOR INSERT
  WITH CHECK (
    auth_uid = auth.uid()
    AND role = 'member'::member_role
    AND status = 'pending_jt'::member_status
  );

-- ========== Self check-in: self/QR events only; semester matches event ==========
DROP POLICY IF EXISTS "Members can self check-in" ON public.attendance;
CREATE POLICY "Members can self check-in"
  ON public.attendance
  FOR INSERT
  WITH CHECK (
    member_id = (SELECT m.id FROM public.members m WHERE m.auth_uid = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.check_in_type = 'self'
        AND e.semester_id = attendance.semester_id
    )
  );

-- ========== Revoke client EXECUTE on SECURITY DEFINER recompute helpers ==========
REVOKE ALL ON FUNCTION public.recompute_member_jt_week_cap(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_member_semester_points(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chicago_week_start(timestamptz) FROM PUBLIC, anon, authenticated;

-- Triggers still run as SECURITY DEFINER owner.

-- ========== Lock down anon reads of PII-bearing leaderboard / points cache ==========
REVOKE SELECT ON public.v_current_leaderboard FROM anon;
REVOKE SELECT ON public.v_jt_leaderboard FROM anon;
REVOKE SELECT ON public.member_semester_points FROM anon;

-- ========== Sports Spectator semester recompute (promote after uncheck) ==========
CREATE OR REPLACE FUNCTION public.recompute_member_spectator_semester_cap(
  p_member_id uuid,
  p_semester_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_member_id IS NULL OR p_semester_id IS NULL THEN
    RETURN;
  END IF;

  WITH ranked AS (
    SELECT
      a.id,
      SUM(e.point_value) OVER (
        ORDER BY a.recorded_at ASC, a.id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS cum_points
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    WHERE a.member_id = p_member_id
      AND a.semester_id = p_semester_id
      AND e.category = 'Sports Spectator'
  )
  UPDATE public.attendance AS a
  SET counted = (r.cum_points <= 10)
  FROM ranked r
  WHERE a.id = r.id
    AND a.counted IS DISTINCT FROM (r.cum_points <= 10);
END;
$$;

COMMENT ON FUNCTION public.recompute_member_spectator_semester_cap(uuid, uuid) IS
  'Sets counted for Sports Spectator attendances in a semester: first rows by recorded_at until 10 points.';

REVOKE ALL ON FUNCTION public.recompute_member_spectator_semester_cap(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.attendance_recompute_spectator_semester_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_semester_id uuid;
  v_event_id uuid;
  v_category text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_member_id := OLD.member_id;
    v_semester_id := OLD.semester_id;
    v_event_id := OLD.event_id;
  ELSE
    v_member_id := NEW.member_id;
    v_semester_id := NEW.semester_id;
    v_event_id := NEW.event_id;
  END IF;

  SELECT e.category INTO v_category FROM public.events e WHERE e.id = v_event_id;

  IF v_category = 'Sports Spectator' THEN
    PERFORM public.recompute_member_spectator_semester_cap(v_member_id, v_semester_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_recompute_spectator_semester_cap ON public.attendance;
CREATE TRIGGER attendance_recompute_spectator_semester_cap
  AFTER INSERT OR DELETE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.attendance_recompute_spectator_semester_cap();

-- ========== JT event updates: also point_value; reset counted when leaving JT scope ==========
CREATE OR REPLACE FUNCTION public.events_recompute_jt_week_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_in_scope boolean;
  v_new_in_scope boolean;
  r RECORD;
BEGIN
  v_old_in_scope := OLD.category IN ('Jiating Event', 'Mixer');
  v_new_in_scope := NEW.category IN ('Jiating Event', 'Mixer');

  IF NOT v_old_in_scope AND NOT v_new_in_scope THEN
    RETURN NEW;
  END IF;

  IF OLD.starts_at IS NOT DISTINCT FROM NEW.starts_at
     AND OLD.category IS NOT DISTINCT FROM NEW.category
     AND OLD.point_value IS NOT DISTINCT FROM NEW.point_value THEN
    RETURN NEW;
  END IF;

  -- Leaving JT Event/Mixer scope: revive any weekly-cap false counts on this event.
  IF v_old_in_scope AND NOT v_new_in_scope THEN
    UPDATE public.attendance
    SET counted = true
    WHERE event_id = NEW.id
      AND counted = false;
  END IF;

  FOR r IN
    SELECT a.member_id
    FROM public.attendance a
    WHERE a.event_id = NEW.id
  LOOP
    IF v_old_in_scope THEN
      PERFORM public.recompute_member_jt_week_cap(
        r.member_id,
        public.chicago_week_start(OLD.starts_at)
      );
    END IF;
    IF v_new_in_scope THEN
      PERFORM public.recompute_member_jt_week_cap(
        r.member_id,
        public.chicago_week_start(NEW.starts_at)
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_recompute_jt_week_cap ON public.events;
CREATE TRIGGER events_recompute_jt_week_cap
  AFTER UPDATE OF starts_at, category, point_value ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_recompute_jt_week_cap();

-- Spectator event category/semester moves
CREATE OR REPLACE FUNCTION public.events_recompute_spectator_semester_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_spec boolean;
  v_new_spec boolean;
  r RECORD;
BEGIN
  v_old_spec := OLD.category = 'Sports Spectator';
  v_new_spec := NEW.category = 'Sports Spectator';

  IF NOT v_old_spec AND NOT v_new_spec THEN
    RETURN NEW;
  END IF;

  IF OLD.category IS NOT DISTINCT FROM NEW.category
     AND OLD.point_value IS NOT DISTINCT FROM NEW.point_value THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT a.member_id, a.semester_id
    FROM public.attendance a
    WHERE a.event_id = NEW.id
  LOOP
    IF v_old_spec THEN
      PERFORM public.recompute_member_spectator_semester_cap(r.member_id, r.semester_id);
    END IF;
    IF v_new_spec THEN
      PERFORM public.recompute_member_spectator_semester_cap(r.member_id, r.semester_id);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_recompute_spectator_semester_cap ON public.events;
CREATE TRIGGER events_recompute_spectator_semester_cap
  AFTER UPDATE OF category, point_value ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_recompute_spectator_semester_cap();
