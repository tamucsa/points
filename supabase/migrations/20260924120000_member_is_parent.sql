-- Parent is a flag that stacks with member/officer/admin so someone can be
-- both an officer and a Jiating parent. Parent-only users may create/manage
-- Jiating Event + Jiating Mixer for their own family.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS is_parent boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.members.is_parent IS
  'Jiating parent flag; combinable with officer/admin. Parents never earn points.';

UPDATE public.members
SET
  is_parent = true,
  role = 'member'::public.member_role
WHERE role = 'parent'::public.member_role;

CREATE OR REPLACE FUNCTION public.get_my_is_parent()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT m.is_parent FROM public.members m WHERE m.auth_uid = auth.uid() LIMIT 1),
    false
  );
$$;

COMMENT ON FUNCTION public.get_my_is_parent() IS
  'True when the signed-in member is marked as a Jiating parent.';

GRANT EXECUTE ON FUNCTION public.get_my_is_parent() TO authenticated;

CREATE OR REPLACE FUNCTION public.parent_can_manage_event(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = p_event_id
      AND (
        (
          e.category = 'Jiating Event'
          AND e.jt_family_id IS NOT DISTINCT FROM public.get_my_jt_family_id()
        )
        OR (
          e.category IN ('Jiating Mixer', 'Mixer')
          AND EXISTS (
            SELECT 1
            FROM public.event_jt_families l
            WHERE l.event_id = e.id
              AND l.jt_family_id IS NOT DISTINCT FROM public.get_my_jt_family_id()
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.parent_can_manage_event(uuid) TO authenticated;

-- ========== Points: is_parent never earns ==========
CREATE OR REPLACE FUNCTION public.recompute_member_semester_points(p_member_id uuid, p_semester_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_parent boolean;
  v_total smallint;
  v_csa smallint;
  v_jt smallint;
  v_sports smallint;
  v_gm smallint;
BEGIN
  IF p_member_id IS NULL OR p_semester_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(m.is_parent, false) INTO v_is_parent
  FROM public.members m
  WHERE m.id = p_member_id;

  IF v_is_parent THEN
    v_total := 0;
    v_csa := 0;
    v_jt := 0;
    v_sports := 0;
    v_gm := 0;
  ELSE
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
  END IF;

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

CREATE OR REPLACE FUNCTION public.members_recompute_points_on_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_semester_id uuid;
BEGIN
  IF OLD.role IS NOT DISTINCT FROM NEW.role
     AND OLD.is_parent IS NOT DISTINCT FROM NEW.is_parent THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_semester_id FROM public.semesters WHERE is_active = true LIMIT 1;
  IF v_semester_id IS NOT NULL THEN
    PERFORM public.recompute_member_semester_points(NEW.id, v_semester_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_recompute_points_on_role_change ON public.members;
CREATE TRIGGER members_recompute_points_on_role_change
  AFTER UPDATE OF role, is_parent ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.members_recompute_points_on_role_change();

DROP VIEW IF EXISTS public.v_current_leaderboard;

CREATE VIEW public.v_current_leaderboard
WITH (security_invoker = true)
AS
SELECT
  m.id,
  m.full_name,
  m.email,
  m.profile_image_url,
  m.role,
  m.is_parent,
  (m.auth_uid IS NOT NULL) AS account_linked,
  jf.name AS jt_family,
  CASE
    WHEN jf.id IS NOT NULL THEN COALESCE(jf.color, '#4f6ef7')
    ELSE NULL
  END AS jt_color,
  COALESCE(msp.total_points, 0)::smallint AS total_points,
  COALESCE(msp.csa_points, 0)::smallint AS csa_points,
  COALESCE(msp.jt_points, 0)::smallint AS jt_points,
  COALESCE(msp.sports_points, 0)::smallint AS sports_points,
  COALESCE(msp.gm_points, 0)::smallint AS gm_points
FROM public.members m
JOIN public.semesters s ON s.is_active = true
LEFT JOIN public.jt_families jf
  ON jf.id = m.jt_family_id
 AND jf.is_active = true
LEFT JOIN public.member_semester_points msp
  ON msp.member_id = m.id AND msp.semester_id = s.id
WHERE m.status = 'active';

GRANT SELECT ON public.v_current_leaderboard TO authenticated;
REVOKE SELECT ON public.v_current_leaderboard FROM anon;

CREATE OR REPLACE FUNCTION public.top_leaderboard_members_per_jt(p_limit integer DEFAULT 3)
RETURNS TABLE (
  id uuid,
  full_name text,
  profile_image_url text,
  jt_family text,
  jt_color text,
  total_points smallint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    ranked.id,
    ranked.full_name,
    ranked.profile_image_url,
    ranked.jt_family,
    ranked.jt_color,
    ranked.total_points
  FROM (
    SELECT
      v.id,
      v.full_name,
      v.profile_image_url,
      v.jt_family,
      v.jt_color,
      v.total_points,
      row_number() OVER (
        PARTITION BY v.jt_family
        ORDER BY v.total_points DESC, v.full_name ASC
      ) AS rn
    FROM public.v_current_leaderboard v
    WHERE v.jt_family IS NOT NULL
      AND COALESCE(v.is_parent, false) = false
      AND v.role IS DISTINCT FROM 'parent'::public.member_role
  ) ranked
  WHERE ranked.rn <= GREATEST(COALESCE(p_limit, 3), 1);
$$;

DROP VIEW IF EXISTS public.v_jt_leaderboard;

CREATE VIEW public.v_jt_leaderboard
WITH (security_invoker = true)
AS
SELECT
  jf.name AS jt_family,
  COALESCE(jf.color, '#4f6ef7') AS jt_color,
  COUNT(DISTINCT m.id) AS member_count,
  COALESCE(SUM(CASE WHEN a.counted THEN e.point_value ELSE 0 END), 0)::smallint AS total_points,
  ROUND(
    COALESCE(SUM(CASE WHEN a.counted THEN e.point_value ELSE 0 END), 0)::numeric
    / NULLIF(COUNT(DISTINCT m.id), 0),
    1
  ) AS avg_points_per_member
FROM public.jt_families jf
JOIN public.semesters s ON s.is_active = true
JOIN public.members m
  ON m.jt_family_id = jf.id
 AND m.status = 'active'
 AND COALESCE(m.is_parent, false) = false
 AND m.role IS DISTINCT FROM 'parent'::public.member_role
LEFT JOIN public.attendance a ON a.member_id = m.id AND a.semester_id = s.id
LEFT JOIN public.events e ON e.id = a.event_id
WHERE jf.is_active = true
GROUP BY jf.id, jf.name, jf.color;

GRANT SELECT ON public.v_jt_leaderboard TO authenticated;
REVOKE SELECT ON public.v_jt_leaderboard FROM anon;

-- Freeze is_parent on self-serve / officer profile updates.
DROP POLICY IF EXISTS "Members can update own profile" ON public.members;
CREATE POLICY "Members can update own profile"
  ON public.members
  FOR UPDATE
  USING (auth_uid = auth.uid())
  WITH CHECK (
    auth_uid = auth.uid()
    AND role = (SELECT m.role FROM public.members m WHERE m.id = members.id)
    AND status = (SELECT m.status FROM public.members m WHERE m.id = members.id)
    AND is_parent IS NOT DISTINCT FROM (SELECT m.is_parent FROM public.members m WHERE m.id = members.id)
    AND NOT (jt_family_id IS DISTINCT FROM (SELECT m.jt_family_id FROM public.members m WHERE m.id = members.id))
    AND NOT (auth_uid IS DISTINCT FROM (SELECT m.auth_uid FROM public.members m WHERE m.id = members.id))
    AND NOT (email IS DISTINCT FROM (SELECT m.email FROM public.members m WHERE m.id = members.id))
  );

DROP POLICY IF EXISTS "Officers can update member profiles" ON public.members;
CREATE POLICY "Officers can update member profiles"
  ON public.members FOR UPDATE
  USING (get_my_role() = 'officer'::member_role)
  WITH CHECK (
    get_my_role() = 'officer'::member_role
    AND role = (SELECT m.role FROM public.members m WHERE m.id = members.id)
    AND status = (SELECT m.status FROM public.members m WHERE m.id = members.id)
    AND is_parent IS NOT DISTINCT FROM (SELECT m.is_parent FROM public.members m WHERE m.id = members.id)
    AND jt_family_id IS NOT DISTINCT FROM (SELECT m.jt_family_id FROM public.members m WHERE m.id = members.id)
  );

-- Parent-only event access (officer/admin keep existing policies).
DROP POLICY IF EXISTS "Parents can view managed events" ON public.events;
CREATE POLICY "Parents can view managed events"
  ON public.events FOR SELECT
  USING (
    public.get_my_is_parent()
    AND public.get_my_role() IS DISTINCT FROM 'officer'::public.member_role
    AND public.get_my_role() IS DISTINCT FROM 'admin'::public.member_role
    AND (
      (
        category = 'Jiating Event'
        AND jt_family_id IS NOT DISTINCT FROM public.get_my_jt_family_id()
      )
      OR (
        category IN ('Jiating Mixer', 'Mixer')
        AND (
          created_by = (SELECT m.id FROM public.members m WHERE m.auth_uid = auth.uid() LIMIT 1)
          OR public.parent_can_manage_event(id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Parents can insert jiating events" ON public.events;
CREATE POLICY "Parents can insert jiating events"
  ON public.events FOR INSERT
  WITH CHECK (
    public.get_my_is_parent()
    AND public.get_my_role() IS DISTINCT FROM 'officer'::public.member_role
    AND public.get_my_role() IS DISTINCT FROM 'admin'::public.member_role
    AND (
      (
        category = 'Jiating Event'
        AND jt_family_id IS NOT DISTINCT FROM public.get_my_jt_family_id()
      )
      OR category IN ('Jiating Mixer', 'Mixer')
    )
  );

DROP POLICY IF EXISTS "Parents can update managed events" ON public.events;
CREATE POLICY "Parents can update managed events"
  ON public.events FOR UPDATE
  USING (
    public.get_my_is_parent()
    AND public.get_my_role() IS DISTINCT FROM 'officer'::public.member_role
    AND public.get_my_role() IS DISTINCT FROM 'admin'::public.member_role
    AND public.parent_can_manage_event(id)
  )
  WITH CHECK (
    public.get_my_is_parent()
    AND public.get_my_role() IS DISTINCT FROM 'officer'::public.member_role
    AND public.get_my_role() IS DISTINCT FROM 'admin'::public.member_role
    AND (
      (
        category = 'Jiating Event'
        AND jt_family_id IS NOT DISTINCT FROM public.get_my_jt_family_id()
      )
      OR category IN ('Jiating Mixer', 'Mixer')
    )
  );

DROP POLICY IF EXISTS "Parents can insert mixer families" ON public.event_jt_families;
CREATE POLICY "Parents can insert mixer families"
  ON public.event_jt_families FOR INSERT
  WITH CHECK (
    public.get_my_is_parent()
    AND public.get_my_role() IS DISTINCT FROM 'officer'::public.member_role
    AND public.get_my_role() IS DISTINCT FROM 'admin'::public.member_role
    AND EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_id
        AND e.category IN ('Jiating Mixer', 'Mixer')
        AND (
          e.created_by = (SELECT m.id FROM public.members m WHERE m.auth_uid = auth.uid() LIMIT 1)
          OR public.parent_can_manage_event(e.id)
        )
    )
  );

DROP POLICY IF EXISTS "Parents can delete mixer families" ON public.event_jt_families;
CREATE POLICY "Parents can delete mixer families"
  ON public.event_jt_families FOR DELETE
  USING (
    public.get_my_is_parent()
    AND public.get_my_role() IS DISTINCT FROM 'officer'::public.member_role
    AND public.get_my_role() IS DISTINCT FROM 'admin'::public.member_role
    AND public.parent_can_manage_event(event_id)
  );

DROP POLICY IF EXISTS "Parents can view members for check-in" ON public.members;
CREATE POLICY "Parents can view members for check-in"
  ON public.members FOR SELECT
  USING (
    public.get_my_is_parent()
    AND public.get_my_role() IS DISTINCT FROM 'officer'::public.member_role
    AND public.get_my_role() IS DISTINCT FROM 'admin'::public.member_role
  );

DROP POLICY IF EXISTS "Parents can insert attendance" ON public.attendance;
CREATE POLICY "Parents can insert attendance"
  ON public.attendance FOR INSERT
  WITH CHECK (
    public.get_my_is_parent()
    AND public.get_my_role() IS DISTINCT FROM 'officer'::public.member_role
    AND public.get_my_role() IS DISTINCT FROM 'admin'::public.member_role
    AND public.parent_can_manage_event(event_id)
  );

DROP POLICY IF EXISTS "Parents can remove attendance" ON public.attendance;
CREATE POLICY "Parents can remove attendance"
  ON public.attendance FOR DELETE
  USING (
    public.get_my_is_parent()
    AND public.get_my_role() IS DISTINCT FROM 'officer'::public.member_role
    AND public.get_my_role() IS DISTINCT FROM 'admin'::public.member_role
    AND public.parent_can_manage_event(event_id)
  );

DROP POLICY IF EXISTS "Parents can view managed attendance" ON public.attendance;
CREATE POLICY "Parents can view managed attendance"
  ON public.attendance FOR SELECT
  USING (
    public.get_my_is_parent()
    AND public.get_my_role() IS DISTINCT FROM 'officer'::public.member_role
    AND public.get_my_role() IS DISTINCT FROM 'admin'::public.member_role
    AND public.parent_can_manage_event(event_id)
  );

-- Recompute anyone newly marked parent (or converted from role=parent).
DO $$
DECLARE
  r RECORD;
  v_semester_id uuid;
BEGIN
  SELECT id INTO v_semester_id FROM public.semesters WHERE is_active = true LIMIT 1;
  IF v_semester_id IS NULL THEN
    RETURN;
  END IF;
  FOR r IN SELECT id FROM public.members WHERE is_parent = true LOOP
    PERFORM public.recompute_member_semester_points(r.id, v_semester_id);
  END LOOP;
END $$;
