-- Parents get the same officer roster/event tools except:
--   * create is still Jiating Event / Jiating Mixer for their family
--   * delete: parents delete those JT events for their family;
--     officers delete every other category. Admins still delete any event.

CREATE OR REPLACE FUNCTION public.is_officer_or_parent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.members m
    WHERE m.auth_uid = auth.uid()
      AND m.status = 'active'::public.member_status
      AND (
        m.role IN ('officer'::public.member_role, 'admin'::public.member_role)
        OR COALESCE(m.is_parent, false)
      )
  );
$$;

COMMENT ON FUNCTION public.is_officer_or_parent() IS
  'True for an active officer, admin, or parent signed-in member.';

GRANT EXECUTE ON FUNCTION public.is_officer_or_parent() TO authenticated;

-- Parents can see every event (drafts included), like officers.
DROP POLICY IF EXISTS "Parents can view managed events" ON public.events;
DROP POLICY IF EXISTS "Parents can view all events" ON public.events;
CREATE POLICY "Parents can view all events"
  ON public.events FOR SELECT
  USING (public.get_my_is_parent());

DROP POLICY IF EXISTS "Parents can update managed events" ON public.events;
DROP POLICY IF EXISTS "Parents can update events" ON public.events;
CREATE POLICY "Parents can update events"
  ON public.events FOR UPDATE
  USING (public.get_my_is_parent())
  WITH CHECK (public.get_my_is_parent());

-- Officers delete non-JT Event/Mixer. Admin keep unrestricted delete.
DROP POLICY IF EXISTS "Officers can delete non-jiating events" ON public.events;
CREATE POLICY "Officers can delete non-jiating events"
  ON public.events FOR DELETE
  USING (
    public.get_my_role() = 'officer'::public.member_role
    AND category IS DISTINCT FROM 'Jiating Event'
    AND category IS DISTINCT FROM 'Jiating Mixer'
    AND category IS DISTINCT FROM 'Mixer'
  );

DROP POLICY IF EXISTS "Parents can delete managed jiating events" ON public.events;
CREATE POLICY "Parents can delete managed jiating events"
  ON public.events FOR DELETE
  USING (
    public.get_my_is_parent()
    AND (
      public.parent_can_manage_event(id)
      OR (
        parent_event_id IS NOT NULL
        AND public.parent_can_manage_event(parent_event_id)
      )
    )
  );

-- Attendance: parents can check in / uncheck like officers.
DROP POLICY IF EXISTS "Parents can insert attendance" ON public.attendance;
CREATE POLICY "Parents can insert attendance"
  ON public.attendance FOR INSERT
  WITH CHECK (public.get_my_is_parent());

DROP POLICY IF EXISTS "Parents can remove attendance" ON public.attendance;
CREATE POLICY "Parents can remove attendance"
  ON public.attendance FOR DELETE
  USING (public.get_my_is_parent());

DROP POLICY IF EXISTS "Parents can view managed attendance" ON public.attendance;
DROP POLICY IF EXISTS "Parents can view attendance" ON public.attendance;
CREATE POLICY "Parents can view attendance"
  ON public.attendance FOR SELECT
  USING (public.get_my_is_parent());

-- Mixer families: parents can edit participating families on any mixer.
DROP POLICY IF EXISTS "Parents can insert mixer families" ON public.event_jt_families;
CREATE POLICY "Parents can insert mixer families"
  ON public.event_jt_families FOR INSERT
  WITH CHECK (
    public.get_my_is_parent()
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.category IN ('Jiating Mixer', 'Mixer')
    )
  );

DROP POLICY IF EXISTS "Parents can delete mixer families" ON public.event_jt_families;
CREATE POLICY "Parents can delete mixer families"
  ON public.event_jt_families FOR DELETE
  USING (public.get_my_is_parent());

DROP POLICY IF EXISTS "Parents can view event jt families" ON public.event_jt_families;
CREATE POLICY "Parents can view event jt families"
  ON public.event_jt_families FOR SELECT
  USING (public.get_my_is_parent());

-- Roster-adjacent officer tables.
DROP POLICY IF EXISTS parents_read_event_guests ON public.event_guests;
CREATE POLICY parents_read_event_guests
  ON public.event_guests FOR SELECT
  USING (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_insert_event_guests ON public.event_guests;
CREATE POLICY parents_insert_event_guests
  ON public.event_guests FOR INSERT
  WITH CHECK (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_update_event_guests ON public.event_guests;
CREATE POLICY parents_update_event_guests
  ON public.event_guests FOR UPDATE
  USING (public.get_my_is_parent())
  WITH CHECK (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_delete_event_guests ON public.event_guests;
CREATE POLICY parents_delete_event_guests
  ON public.event_guests FOR DELETE
  USING (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_read_event_rsvps ON public.event_rsvps;
CREATE POLICY parents_read_event_rsvps
  ON public.event_rsvps FOR SELECT
  USING (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_insert_event_rsvps ON public.event_rsvps;
CREATE POLICY parents_insert_event_rsvps
  ON public.event_rsvps FOR INSERT
  WITH CHECK (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_update_event_rsvps ON public.event_rsvps;
CREATE POLICY parents_update_event_rsvps
  ON public.event_rsvps FOR UPDATE
  USING (public.get_my_is_parent())
  WITH CHECK (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_delete_event_rsvps ON public.event_rsvps;
CREATE POLICY parents_delete_event_rsvps
  ON public.event_rsvps FOR DELETE
  USING (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_read_event_import_rows ON public.event_import_rows;
CREATE POLICY parents_read_event_import_rows
  ON public.event_import_rows FOR SELECT
  USING (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_insert_event_import_rows ON public.event_import_rows;
CREATE POLICY parents_insert_event_import_rows
  ON public.event_import_rows FOR INSERT
  WITH CHECK (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_update_event_import_rows ON public.event_import_rows;
CREATE POLICY parents_update_event_import_rows
  ON public.event_import_rows FOR UPDATE
  USING (public.get_my_is_parent())
  WITH CHECK (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_delete_event_import_rows ON public.event_import_rows;
CREATE POLICY parents_delete_event_import_rows
  ON public.event_import_rows FOR DELETE
  USING (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_read_guest_export_log ON public.guest_export_log;
CREATE POLICY parents_read_guest_export_log
  ON public.guest_export_log FOR SELECT
  USING (public.get_my_is_parent());

DROP POLICY IF EXISTS parents_insert_guest_export_log ON public.guest_export_log;
CREATE POLICY parents_insert_guest_export_log
  ON public.guest_export_log FOR INSERT
  WITH CHECK (public.get_my_is_parent());

-- Staff RPCs: allow parents through the same officer probe.
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
  SELECT public.is_officer_or_parent() INTO v_is_officer;

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
  SELECT public.is_officer_or_parent() INTO v_is_officer;

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
  SELECT public.is_officer_or_parent() INTO v_is_officer;

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
  SELECT public.is_officer_or_parent() INTO v_is_officer;

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
            AND (o.role IN ('officer', 'admin') OR COALESCE(o.is_parent, false))
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
