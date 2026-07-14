-- Weekly Jiating Event + Mixer member point cap (max 4 counting attendances per Mon–Sun America/Chicago week).
-- Prefer highest point_value, then earlier starts_at. Olympics and other categories are out of scope.
-- Composes with Spectator BEFORE INSERT trigger (semester 10-pt sum); this recompute only touches JT Event / Mixer rows.

CREATE OR REPLACE FUNCTION public.chicago_week_start(p_ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    (p_ts AT TIME ZONE 'America/Chicago')::date
    - ((EXTRACT(ISODOW FROM (p_ts AT TIME ZONE 'America/Chicago')::date)::integer) - 1)
  )::date;
$$;

COMMENT ON FUNCTION public.chicago_week_start(timestamptz) IS
  'Monday (date) of the America/Chicago calendar week containing p_ts.';

CREATE OR REPLACE FUNCTION public.recompute_member_jt_week_cap(
  p_member_id uuid,
  p_week_start date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_member_id IS NULL OR p_week_start IS NULL THEN
    RETURN;
  END IF;

  WITH ranked AS (
    SELECT
      a.id,
      ROW_NUMBER() OVER (
        ORDER BY e.point_value DESC, e.starts_at ASC, a.id ASC
      ) AS rn
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    WHERE a.member_id = p_member_id
      AND e.category IN ('Jiating Event', 'Mixer')
      AND e.starts_at >= (p_week_start::timestamp AT TIME ZONE 'America/Chicago')
      AND e.starts_at < ((p_week_start + 7)::timestamp AT TIME ZONE 'America/Chicago')
  )
  UPDATE public.attendance AS a
  SET counted = (r.rn <= 4)
  FROM ranked r
  WHERE a.id = r.id
    AND a.counted IS DISTINCT FROM (r.rn <= 4);
END;
$$;

COMMENT ON FUNCTION public.recompute_member_jt_week_cap(uuid, date) IS
  'Sets counted for Jiating Event/Mixer attendances in a Chicago Mon–Sun week: top 4 by point_value then starts_at.';

REVOKE ALL ON FUNCTION public.recompute_member_jt_week_cap(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_member_jt_week_cap(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.chicago_week_start(timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.attendance_recompute_jt_week_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_event_id uuid;
  v_starts_at timestamptz;
  v_category text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_member_id := OLD.member_id;
    v_event_id := OLD.event_id;
  ELSE
    v_member_id := NEW.member_id;
    v_event_id := NEW.event_id;
  END IF;

  SELECT e.starts_at, e.category
  INTO v_starts_at, v_category
  FROM public.events e
  WHERE e.id = v_event_id;

  IF v_starts_at IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF v_category IN ('Jiating Event', 'Mixer') THEN
    PERFORM public.recompute_member_jt_week_cap(
      v_member_id,
      public.chicago_week_start(v_starts_at)
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attendance_recompute_jt_week_cap ON public.attendance;
CREATE TRIGGER attendance_recompute_jt_week_cap
  AFTER INSERT OR DELETE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.attendance_recompute_jt_week_cap();

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
     AND OLD.category IS NOT DISTINCT FROM NEW.category THEN
    RETURN NEW;
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
  AFTER UPDATE OF starts_at, category ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.events_recompute_jt_week_cap();

-- Backfill active-semester (and any remaining) in-scope member/week pairs
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT
      a.member_id,
      public.chicago_week_start(e.starts_at) AS week_start
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
    WHERE e.category IN ('Jiating Event', 'Mixer')
  LOOP
    PERFORM public.recompute_member_jt_week_cap(r.member_id, r.week_start);
  END LOOP;
END;
$$;
