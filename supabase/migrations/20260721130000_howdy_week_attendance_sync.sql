-- Howdy Week: sync csv_import attendance for linked guests (0-point check-ins).
-- Extends replace_event_guests and adds claim RPC for self-register auto-link.

CREATE OR REPLACE FUNCTION public.replace_event_guests(
  p_event_id uuid,
  p_rows jsonb,
  p_recorded_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_officer boolean;
  v_semester_id uuid;
  v_recorded_by uuid;
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

  SELECT e.semester_id INTO v_semester_id
  FROM public.events e
  WHERE e.id = p_event_id;

  IF v_semester_id IS NULL THEN
    RAISE EXCEPTION 'Event not found.';
  END IF;

  SELECT m.id INTO v_recorded_by
  FROM public.members m
  WHERE m.auth_uid = auth.uid()
  LIMIT 1;

  IF p_recorded_by IS NOT NULL THEN
    v_recorded_by := p_recorded_by;
  END IF;

  DELETE FROM public.event_guests WHERE event_id = p_event_id;

  INSERT INTO public.event_guests (
    event_id, semester_id, email, full_name, graduation_year, member_id
  )
  SELECT
    p_event_id,
    v_semester_id,
    lower(trim(row->>'email')),
    NULLIF(row->>'full_name', ''),
    (row->>'graduation_year')::integer,
    (row->>'member_id')::uuid
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS row;

  -- Upsert attendance for linked guests (0 pts via events.point_value).
  INSERT INTO public.attendance (
    member_id, event_id, semester_id, check_in_method, recorded_by
  )
  SELECT DISTINCT
    (row->>'member_id')::uuid,
    p_event_id,
    v_semester_id,
    'csv_import'::public.checkin_method,
    v_recorded_by
  FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS row
  WHERE NULLIF(row->>'member_id', '') IS NOT NULL
  ON CONFLICT (member_id, event_id) DO UPDATE
  SET
    check_in_method = EXCLUDED.check_in_method,
    recorded_by = COALESCE(EXCLUDED.recorded_by, public.attendance.recorded_by);

  -- Prune Howdy Week CSV attendance no longer on the linked guest list.
  DELETE FROM public.attendance a
  WHERE a.event_id = p_event_id
    AND a.check_in_method = 'csv_import'::public.checkin_method
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_rows, '[]'::jsonb)) AS row
      WHERE NULLIF(row->>'member_id', '') IS NOT NULL
        AND (row->>'member_id')::uuid = a.member_id
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_event_guests(uuid, jsonb, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.replace_event_guests(uuid, jsonb, uuid) TO authenticated;

-- Keep 2-arg overload working for any older callers (recorded_by from auth).
CREATE OR REPLACE FUNCTION public.replace_event_guests(
  p_event_id uuid,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.replace_event_guests(p_event_id, p_rows, NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_event_guests(uuid, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.replace_event_guests(uuid, jsonb) TO authenticated;

-- Self-register / claim: link unmatched guests by email and create attendance.
CREATE OR REPLACE FUNCTION public.claim_howdy_week_guests_for_member(
  p_member_id uuid,
  p_email text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_ok boolean;
  v_email text;
  v_linked integer := 0;
  r record;
BEGIN
  v_email := lower(trim(COALESCE(p_email, '')));
  IF v_email = '' THEN
    RETURN 0;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = p_member_id
      AND (
        m.auth_uid = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.members o
          WHERE o.auth_uid = auth.uid()
            AND o.role IN ('officer', 'admin')
            AND o.status = 'active'::member_status
        )
      )
  ) INTO v_ok;

  -- Service-role / no JWT: allow when auth.uid() is null (admin import path).
  IF NOT COALESCE(v_ok, false) AND auth.uid() IS NULL THEN
    v_ok := true;
  END IF;

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Not allowed to claim Howdy Week guests for this member.';
  END IF;

  FOR r IN
    SELECT g.id, g.event_id, g.semester_id
    FROM public.event_guests g
    WHERE g.member_id IS NULL
      AND g.email = v_email
  LOOP
    UPDATE public.event_guests
    SET member_id = p_member_id
    WHERE id = r.id;

    INSERT INTO public.attendance (
      member_id, event_id, semester_id, check_in_method, recorded_by
    )
    VALUES (
      p_member_id,
      r.event_id,
      r.semester_id,
      'csv_import'::public.checkin_method,
      p_member_id
    )
    ON CONFLICT (member_id, event_id) DO NOTHING;

    v_linked := v_linked + 1;
  END LOOP;

  RETURN v_linked;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_howdy_week_guests_for_member(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_howdy_week_guests_for_member(uuid, text) TO authenticated, service_role;
