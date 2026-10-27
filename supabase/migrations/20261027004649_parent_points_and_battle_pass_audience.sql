-- Parents keep a real semester total for profiles and the members list.
-- Leaderboards and Jiating standings still skip them.
-- Each battle pass reward chooses who can redeem it: members, officers
-- (including admins), and parents, in any combination.

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

COMMENT ON FUNCTION public.recompute_member_semester_points(uuid, uuid) IS
  'Upserts counted point buckets for one member in one semester. Parents are stored the same way and stay off leaderboards and Jiating totals.';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT a.member_id, a.semester_id
    FROM public.attendance a
    JOIN public.members m ON m.id = a.member_id
    WHERE COALESCE(m.is_parent, false)
       OR m.role = 'parent'::public.member_role
  LOOP
    PERFORM public.recompute_member_semester_points(r.member_id, r.semester_id);
  END LOOP;
END $$;

UPDATE public.semester_summaries ss
SET
  total_points = msp.total_points,
  csa_points = msp.csa_points,
  jt_points = msp.jt_points,
  sports_points = msp.sports_points,
  gm_points = msp.gm_points
FROM public.member_semester_points msp
JOIN public.members m ON m.id = msp.member_id
WHERE ss.member_id = msp.member_id
  AND ss.semester_id = msp.semester_id
  AND (
    COALESCE(m.is_parent, false)
    OR m.role = 'parent'::public.member_role
  );

ALTER TABLE public.battle_pass_rewards
  ADD COLUMN IF NOT EXISTS redeem_members boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS redeem_officers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS redeem_parents boolean NOT NULL DEFAULT false;

COMMENT ON TABLE public.battle_pass_rewards IS
  'Semester battle pass catalog. redeem_members, redeem_officers, and redeem_parents choose who can unlock a row. Admins count as officers. All three false means nobody can redeem it.';

CREATE OR REPLACE FUNCTION public.seed_battle_pass_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.battle_pass_rewards (
    semester_id,
    name,
    points_required,
    redeem_members,
    redeem_officers,
    redeem_parents
  )
  VALUES
    (NEW.id, 'CSA Sticker', 20, true, false, false),
    (NEW.id, 'Free Boba', 40, true, false, false),
    (NEW.id, 'Past Merch', 50, true, false, false),
    (NEW.id, 'Pie an Officer/Parent', 70, true, false, false),
    (NEW.id, 'Blindbox', 90, true, false, false);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_battle_pass_pickup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points integer;
  v_required integer;
  v_semester uuid;
  v_members boolean;
  v_officers boolean;
  v_parents boolean;
  v_role public.member_role;
  v_parent boolean;
  v_status public.member_status;
BEGIN
  IF NOT public.is_officer_or_parent() THEN
    RAISE EXCEPTION 'Officer access required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT
    r.points_required,
    r.semester_id,
    r.redeem_members,
    r.redeem_officers,
    r.redeem_parents
  INTO v_required, v_semester, v_members, v_officers, v_parents
  FROM public.battle_pass_rewards r
  WHERE r.id = NEW.reward_id;

  IF v_semester IS NULL THEN
    RAISE EXCEPTION 'Reward not found.';
  END IF;

  SELECT m.role, COALESCE(m.is_parent, false), m.status
  INTO v_role, v_parent, v_status
  FROM public.members m
  WHERE m.id = NEW.member_id;

  IF v_role IS NULL OR v_status IS DISTINCT FROM 'active'::public.member_status THEN
    RAISE EXCEPTION 'Only active members can pick up battle pass rewards.';
  END IF;

  IF NOT (
    (v_members AND v_role = 'member'::public.member_role AND NOT v_parent)
    OR (v_officers AND v_role IN ('officer'::public.member_role, 'admin'::public.member_role))
    OR (v_parents AND v_parent)
  ) THEN
    RAISE EXCEPTION 'This reward is not available for this member.';
  END IF;

  SELECT msp.total_points
  INTO v_points
  FROM public.member_semester_points msp
  WHERE msp.member_id = NEW.member_id
    AND msp.semester_id = v_semester;

  IF COALESCE(v_points, 0) < v_required THEN
    RAISE EXCEPTION 'This member has not reached this reward yet.';
  END IF;

  SELECT m.id
  INTO NEW.recorded_by
  FROM public.members m
  WHERE m.auth_uid = auth.uid()
  LIMIT 1;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_battle_pass_pickup() IS
  'Officers can record a pickup only when the member can redeem that reward and has enough points for its semester.';
