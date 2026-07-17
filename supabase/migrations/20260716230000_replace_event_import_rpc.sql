-- Atomic CSV import replacement: upsert attendance, prune members not in the
-- new CSV, and swap staging rows in a single transaction so a mid-step
-- failure can never leave the import half-applied.

CREATE OR REPLACE FUNCTION public.replace_event_import(
  p_event_id uuid,
  p_check_in_method text,
  p_attendance jsonb,
  p_staging jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_officer boolean;
  v_method public.checkin_method;
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

  IF p_check_in_method NOT IN ('csv_import', 'manual') THEN
    RAISE EXCEPTION 'Unsupported check-in method for import: %', p_check_in_method;
  END IF;
  v_method := p_check_in_method::public.checkin_method;

  INSERT INTO public.attendance (
    member_id, event_id, semester_id, check_in_method, recorded_by, point_value_override
  )
  SELECT
    (row->>'member_id')::uuid,
    p_event_id,
    (row->>'semester_id')::uuid,
    v_method,
    (row->>'recorded_by')::uuid,
    (row->>'point_value_override')::smallint
  FROM jsonb_array_elements(COALESCE(p_attendance, '[]'::jsonb)) AS row
  ON CONFLICT (member_id, event_id) DO UPDATE
  SET
    check_in_method = EXCLUDED.check_in_method,
    recorded_by = EXCLUDED.recorded_by,
    point_value_override = EXCLUDED.point_value_override;

  DELETE FROM public.attendance a
  WHERE a.event_id = p_event_id
    AND a.check_in_method = v_method
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(p_attendance, '[]'::jsonb)) AS row
      WHERE (row->>'member_id')::uuid = a.member_id
    );

  DELETE FROM public.event_import_rows WHERE event_id = p_event_id;

  INSERT INTO public.event_import_rows (
    event_id, kind, email, full_name, organization, points, member_id, is_guest, applied
  )
  SELECT
    p_event_id,
    (row->>'kind')::public.event_import_kind,
    row->>'email',
    NULLIF(row->>'full_name', ''),
    NULLIF(row->>'organization', ''),
    (row->>'points')::smallint,
    (row->>'member_id')::uuid,
    COALESCE((row->>'is_guest')::boolean, false),
    COALESCE((row->>'applied')::boolean, false)
  FROM jsonb_array_elements(COALESCE(p_staging, '[]'::jsonb)) AS row;
END;
$function$;

REVOKE ALL ON FUNCTION public.replace_event_import(uuid, text, jsonb, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.replace_event_import(uuid, text, jsonb, jsonb) TO authenticated;
