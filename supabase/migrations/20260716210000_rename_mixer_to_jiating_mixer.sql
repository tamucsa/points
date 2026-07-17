-- Rename the "Mixer" event category to "Jiating Mixer".
-- Legacy 'Mixer' values are kept in every IN (...) scope check so any
-- historical rows continue to count correctly.

UPDATE public.events SET category = 'Jiating Mixer' WHERE category = 'Mixer';

-- Semester point buckets: JT bucket now includes 'Jiating Mixer'.
CREATE OR REPLACE FUNCTION public.recompute_member_semester_points(p_member_id uuid, p_semester_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

-- Weekly Jiating Event + Jiating Mixer attendance cap.
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
        ORDER BY COALESCE(a.point_value_override, e.point_value) DESC,
                 e.starts_at ASC,
                 a.id ASC
      ) AS rn
    FROM public.attendance a
    JOIN public.events e ON e.id = a.event_id
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

-- Attendance trigger: fire the weekly cap for Jiating Event / Jiating Mixer.
CREATE OR REPLACE FUNCTION public.attendance_recompute_jt_week_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF v_category IN ('Jiating Event', 'Jiating Mixer', 'Mixer') THEN
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
$function$;

-- Events trigger: recompute weekly cap when a Jiating Event / Jiating Mixer changes.
CREATE OR REPLACE FUNCTION public.events_recompute_jt_week_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_old_in_scope boolean;
  v_new_in_scope boolean;
  r RECORD;
BEGIN
  v_old_in_scope := OLD.category IN ('Jiating Event', 'Jiating Mixer', 'Mixer');
  v_new_in_scope := NEW.category IN ('Jiating Event', 'Jiating Mixer', 'Mixer');

  IF NOT v_old_in_scope AND NOT v_new_in_scope THEN
    RETURN NEW;
  END IF;

  IF OLD.starts_at IS NOT DISTINCT FROM NEW.starts_at
     AND OLD.category IS NOT DISTINCT FROM NEW.category
     AND OLD.point_value IS NOT DISTINCT FROM NEW.point_value THEN
    RETURN NEW;
  END IF;

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
$function$;
