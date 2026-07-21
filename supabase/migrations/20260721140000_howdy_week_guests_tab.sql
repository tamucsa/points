-- Howdy Week Guests tab: prospect aggregation RPC + export audit log.

CREATE TABLE IF NOT EXISTS public.guest_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_by uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  semester_id uuid NOT NULL REFERENCES public.semesters (id) ON DELETE CASCADE,
  row_count integer NOT NULL CHECK (row_count >= 0),
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guest_export_log_semester_created
  ON public.guest_export_log (semester_id, created_at DESC);

COMMENT ON TABLE public.guest_export_log IS
  'Audit log of Howdy Week guest CSV exports from the Guests tab.';

ALTER TABLE public.guest_export_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS officers_read_guest_export_log ON public.guest_export_log;
CREATE POLICY officers_read_guest_export_log
  ON public.guest_export_log FOR SELECT
  USING (get_my_role() IN ('officer', 'admin'));

DROP POLICY IF EXISTS officers_insert_guest_export_log ON public.guest_export_log;
CREATE POLICY officers_insert_guest_export_log
  ON public.guest_export_log FOR INSERT
  WITH CHECK (get_my_role() IN ('officer', 'admin'));

-- Paginated unmatched Howdy Week prospects for a semester (grouped by email).
CREATE OR REPLACE FUNCTION public.list_howdy_week_guest_prospects(
  p_semester_id uuid,
  p_query text DEFAULT '',
  p_min_events integer DEFAULT 1,
  p_event_id uuid DEFAULT NULL,
  p_sort text DEFAULT 'event_count',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_officer boolean;
  v_q text;
  v_min integer;
  v_limit integer;
  v_offset integer;
  v_sort text;
  v_total integer;
  v_rows jsonb;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_uid = auth.uid()
      AND m.role IN ('officer', 'admin')
      AND m.status = 'active'::member_status
  ) INTO v_is_officer;

  IF NOT v_is_officer THEN
    RAISE EXCEPTION 'Officer access required.';
  END IF;

  IF p_semester_id IS NULL THEN
    RAISE EXCEPTION 'Semester is required.';
  END IF;

  v_q := lower(trim(COALESCE(p_query, '')));
  v_min := GREATEST(COALESCE(p_min_events, 1), 1);
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);
  v_sort := CASE
    WHEN p_sort IN ('event_count', 'name', 'last_attended') THEN p_sort
    ELSE 'event_count'
  END;

  WITH base AS (
    SELECT
      g.email,
      g.full_name,
      g.graduation_year,
      g.event_id,
      e.name AS event_name,
      e.starts_at,
      g.created_at AS guest_created_at
    FROM public.event_guests g
    INNER JOIN public.events e ON e.id = g.event_id
    WHERE g.semester_id = p_semester_id
      AND g.member_id IS NULL
      AND e.category = 'Howdy Week'
      AND (p_event_id IS NULL OR g.event_id = p_event_id)
  ),
  agg AS (
    SELECT
      b.email,
      COUNT(DISTINCT b.event_id)::integer AS event_count,
      MAX(b.starts_at) AS last_attended_at,
      (
        SELECT b2.full_name
        FROM base b2
        WHERE b2.email = b.email
          AND b2.full_name IS NOT NULL
          AND trim(b2.full_name) <> ''
        ORDER BY b2.guest_created_at DESC NULLS LAST, b2.starts_at DESC NULLS LAST
        LIMIT 1
      ) AS full_name,
      (
        SELECT b2.graduation_year
        FROM base b2
        WHERE b2.email = b.email
          AND b2.graduation_year IS NOT NULL
        ORDER BY b2.guest_created_at DESC NULLS LAST, b2.starts_at DESC NULLS LAST
        LIMIT 1
      ) AS graduation_year,
      (
        SELECT COALESCE(array_agg(DISTINCT trim(b2.full_name)) FILTER (
          WHERE b2.full_name IS NOT NULL
            AND trim(b2.full_name) <> ''
            AND lower(trim(b2.full_name)) IS DISTINCT FROM lower(trim((
              SELECT b3.full_name
              FROM base b3
              WHERE b3.email = b.email
                AND b3.full_name IS NOT NULL
                AND trim(b3.full_name) <> ''
              ORDER BY b3.guest_created_at DESC NULLS LAST, b3.starts_at DESC NULLS LAST
              LIMIT 1
            )))
        ), ARRAY[]::text[])
        FROM base b2
        WHERE b2.email = b.email
      ) AS other_names,
      (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'id', x.event_id,
            'name', x.event_name,
            'starts_at', x.starts_at
          )
          ORDER BY x.starts_at DESC NULLS LAST
        ), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (b2.event_id)
            b2.event_id,
            b2.event_name,
            b2.starts_at
          FROM base b2
          WHERE b2.email = b.email
          ORDER BY b2.event_id, b2.starts_at DESC NULLS LAST
        ) x
      ) AS events
    FROM base b
    GROUP BY b.email
  ),
  filtered AS (
    SELECT *
    FROM agg a
    WHERE a.event_count >= v_min
      AND (
        v_q = ''
        OR a.email ILIKE '%' || v_q || '%'
        OR COALESCE(a.full_name, '') ILIKE '%' || v_q || '%'
      )
  )
  SELECT COUNT(*)::integer INTO v_total FROM filtered;

  SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      f.email,
      f.full_name,
      f.other_names,
      f.graduation_year,
      f.event_count,
      f.last_attended_at,
      f.events
    FROM filtered f
    ORDER BY
      CASE WHEN v_sort = 'event_count' THEN f.event_count END DESC NULLS LAST,
      CASE WHEN v_sort = 'name' THEN lower(COALESCE(f.full_name, f.email)) END ASC NULLS LAST,
      CASE WHEN v_sort = 'last_attended' THEN f.last_attended_at END DESC NULLS LAST,
      lower(COALESCE(f.full_name, f.email)) ASC,
      f.email ASC
    LIMIT v_limit
    OFFSET v_offset
  ) p;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total', COALESCE(v_total, 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.list_howdy_week_guest_prospects(uuid, text, integer, uuid, text, integer, integer)
  FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_howdy_week_guest_prospects(uuid, text, integer, uuid, text, integer, integer)
  TO authenticated;

-- Bulk rematch: link all unmatched Howdy Week guest rows for an email in a semester.
CREATE OR REPLACE FUNCTION public.rematch_howdy_week_guest_email(
  p_semester_id uuid,
  p_email text,
  p_member_id uuid,
  p_recorded_by uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_officer boolean;
  v_email text;
  v_member record;
  v_recorded_by uuid;
  v_linked integer := 0;
  r record;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.auth_uid = auth.uid()
      AND m.role IN ('officer', 'admin')
      AND m.status = 'active'::member_status
  ) INTO v_is_officer;

  IF NOT v_is_officer THEN
    RAISE EXCEPTION 'Officer access required.';
  END IF;

  v_email := lower(trim(COALESCE(p_email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Email is required.';
  END IF;

  SELECT m.id, m.full_name, m.email
  INTO v_member
  FROM public.members m
  WHERE m.id = p_member_id;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Member not found.';
  END IF;

  SELECT m.id INTO v_recorded_by
  FROM public.members m
  WHERE m.auth_uid = auth.uid()
  LIMIT 1;

  IF p_recorded_by IS NOT NULL THEN
    v_recorded_by := p_recorded_by;
  END IF;

  FOR r IN
    SELECT g.id, g.event_id, g.semester_id
    FROM public.event_guests g
    INNER JOIN public.events e ON e.id = g.event_id
    WHERE g.semester_id = p_semester_id
      AND g.member_id IS NULL
      AND g.email = v_email
      AND e.category = 'Howdy Week'
  LOOP
    -- Prefer an existing guest row for this member email on the same event.
    IF EXISTS (
      SELECT 1 FROM public.event_guests g2
      WHERE g2.event_id = r.event_id
        AND g2.email = lower(trim(v_member.email))
        AND g2.id <> r.id
    ) THEN
      UPDATE public.event_guests
      SET member_id = COALESCE(member_id, p_member_id)
      WHERE event_id = r.event_id
        AND email = lower(trim(v_member.email));

      DELETE FROM public.event_guests WHERE id = r.id;
    ELSE
      UPDATE public.event_guests
      SET
        member_id = p_member_id,
        email = lower(trim(v_member.email)),
        full_name = v_member.full_name
      WHERE id = r.id;
    END IF;

    INSERT INTO public.attendance (
      member_id, event_id, semester_id, check_in_method, recorded_by
    )
    VALUES (
      p_member_id,
      r.event_id,
      r.semester_id,
      'csv_import'::public.checkin_method,
      COALESCE(v_recorded_by, p_member_id)
    )
    ON CONFLICT (member_id, event_id) DO NOTHING;

    v_linked := v_linked + 1;
  END LOOP;

  RETURN v_linked;
END;
$function$;

REVOKE ALL ON FUNCTION public.rematch_howdy_week_guest_email(uuid, text, uuid, uuid)
  FROM anon, public;
GRANT EXECUTE ON FUNCTION public.rematch_howdy_week_guest_email(uuid, text, uuid, uuid)
  TO authenticated;
