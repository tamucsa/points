-- CSA-Wide Mixers (csv_import check-in) + Philanthropy monetary points (manual_points).
-- Adds attendance.point_value_override for variable per-member points and staging table
-- event_import_rows for unmatched CSV rows officers can manually match.

-- ========== Enum extensions ==========
DO $$ BEGIN
  ALTER TYPE public.checkin_type ADD VALUE IF NOT EXISTS 'csv_import';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.checkin_type ADD VALUE IF NOT EXISTS 'manual_points';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.checkin_method ADD VALUE IF NOT EXISTS 'csv_import';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.checkin_method ADD VALUE IF NOT EXISTS 'manual';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ========== Per-attendance point override (monetary / variable awards) ==========
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS point_value_override smallint;

COMMENT ON COLUMN public.attendance.point_value_override IS
  'When set, overrides events.point_value for this attendance row (e.g. monetary philanthropy).';

-- ========== Staging rows for CSV imports ==========
DO $$ BEGIN
  CREATE TYPE public.event_import_kind AS ENUM ('mixer_attendance', 'manual_points');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.event_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  kind public.event_import_kind NOT NULL,
  email text NOT NULL,
  full_name text,
  organization text,
  points smallint,
  member_id uuid REFERENCES public.members (id) ON DELETE SET NULL,
  is_guest boolean NOT NULL DEFAULT false,
  applied boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_import_rows_event_email_key UNIQUE (event_id, email)
);

CREATE INDEX IF NOT EXISTS idx_event_import_rows_event_id
  ON public.event_import_rows (event_id);
CREATE INDEX IF NOT EXISTS idx_event_import_rows_member_id
  ON public.event_import_rows (member_id)
  WHERE member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_import_rows_unmatched
  ON public.event_import_rows (event_id)
  WHERE member_id IS NULL AND is_guest = false;

ALTER TABLE public.event_import_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS officers_read_event_import_rows ON public.event_import_rows;
CREATE POLICY officers_read_event_import_rows
  ON public.event_import_rows FOR SELECT
  USING (get_my_role() IN ('officer', 'admin'));

DROP POLICY IF EXISTS officers_insert_event_import_rows ON public.event_import_rows;
CREATE POLICY officers_insert_event_import_rows
  ON public.event_import_rows FOR INSERT
  WITH CHECK (get_my_role() IN ('officer', 'admin'));

DROP POLICY IF EXISTS officers_update_event_import_rows ON public.event_import_rows;
CREATE POLICY officers_update_event_import_rows
  ON public.event_import_rows FOR UPDATE
  USING (get_my_role() IN ('officer', 'admin'))
  WITH CHECK (get_my_role() IN ('officer', 'admin'));

DROP POLICY IF EXISTS officers_delete_event_import_rows ON public.event_import_rows;
CREATE POLICY officers_delete_event_import_rows
  ON public.event_import_rows FOR DELETE
  USING (get_my_role() IN ('officer', 'admin'));

-- ========== Points recompute: COALESCE override + CSA-Wide Mixers in CSA bucket ==========
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
    COALESCE(SUM(CASE
      WHEN a.counted THEN COALESCE(a.point_value_override, e.point_value)
      ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND e.category IN (
        'CSA-Wide', 'CSA-Wide Mixers', 'Philanthropy', 'Concessions'
      )
      THEN COALESCE(a.point_value_override, e.point_value) ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND e.category IN ('Jiating Olympics', 'Jiating Event', 'Mixer')
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
$$;

COMMENT ON FUNCTION public.recompute_member_semester_points(uuid, uuid) IS
  'Upserts counted point buckets for one member in one semester; uses attendance.point_value_override when set.';

-- Fire semester recompute when override changes
DROP TRIGGER IF EXISTS attendance_recompute_member_semester_points ON public.attendance;
CREATE TRIGGER attendance_recompute_member_semester_points
  AFTER INSERT OR DELETE OR UPDATE OF counted, member_id, semester_id, event_id, point_value_override
  ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.attendance_recompute_member_semester_points();

-- ========== Spectator cap: COALESCE override ==========
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
      SUM(COALESCE(a.point_value_override, e.point_value)) OVER (
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

-- ========== JT weekly cap: COALESCE override for ranking ==========
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
        ORDER BY COALESCE(a.point_value_override, e.point_value) DESC,
                 e.starts_at ASC,
                 a.id ASC
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
