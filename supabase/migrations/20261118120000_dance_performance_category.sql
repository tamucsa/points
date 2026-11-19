-- Dance categories:
--   * 'Dance' is renamed to 'Dance Practice' (1 pt, officer check-in).
--   * New 'Dance Performance' (2 pts, officer check-in) with an optional linked
--     'Dance Spectator' child event (1 pt, self/QR + officer override, no semester cap).
-- All three count toward the Sports & Dance bucket.
--
-- Participants cannot also be spectators: a member checked in to a parent event
-- (Sports or Dance Performance) cannot check in to its spectator child, and vice versa.

-- ========== Points buckets: include the new Dance categories ==========
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
  v_quiz smallint;
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
        OR e.category IN ('Dance', 'Dance Practice', 'Dance Performance', 'Dance Spectator')
      ) THEN COALESCE(a.point_value_override, e.point_value) ELSE 0 END), 0)::smallint,
    COALESCE(SUM(CASE
      WHEN a.counted AND e.category = 'General Meeting'
      THEN COALESCE(a.point_value_override, e.point_value) ELSE 0 END), 0)::smallint
  INTO v_total, v_csa, v_jt, v_sports, v_gm
  FROM public.attendance a
  JOIN public.events e ON e.id = a.event_id
  WHERE a.member_id = p_member_id
    AND a.semester_id = p_semester_id;

  SELECT COALESCE(SUM(q.points), 0)::smallint
  INTO v_quiz
  FROM public.gm_culture_quiz_results q
  JOIN public.members m ON m.id = q.member_id
  WHERE q.member_id = p_member_id
    AND q.semester_id = p_semester_id
    AND COALESCE(m.is_parent, false) = false
    AND m.role IS DISTINCT FROM 'parent'::public.member_role;

  v_total := (COALESCE(v_total, 0) + COALESCE(v_quiz, 0))::smallint;
  v_gm := (COALESCE(v_gm, 0) + COALESCE(v_quiz, 0))::smallint;

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
  'Upserts counted point buckets for one member in one semester, including Culture Quiz points in the GM bucket. Sports & Dance = Sports, Sports Spectator, Dance Practice, Dance Performance, Dance Spectator. Parents are stored the same way for attendance and stay off leaderboards. Culture Quiz rows for parents are ignored.';

REVOKE ALL ON FUNCTION public.recompute_member_semester_points(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ========== Rename existing Dance events (after the bucket function knows the new name) ==========
UPDATE public.events
SET category = 'Dance Practice'
WHERE category = 'Dance';

-- ========== Participants cannot be spectators ==========
CREATE OR REPLACE FUNCTION public.attendance_block_participant_spectator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid;
  v_spectator_id uuid;
  v_is_spectator boolean;
BEGIN
  SELECT e.parent_event_id INTO v_parent_id
  FROM public.events e
  WHERE e.id = NEW.event_id;

  IF v_parent_id IS NOT NULL THEN
    -- Checking in to a spectator child: block when already a participant.
    v_is_spectator := true;
    v_spectator_id := NEW.event_id;
  ELSE
    -- Checking in to a parent event: block when already a spectator of it.
    SELECT c.id INTO v_spectator_id
    FROM public.events c
    WHERE c.parent_event_id = NEW.event_id
    LIMIT 1;

    IF v_spectator_id IS NULL THEN
      RETURN NEW;
    END IF;

    v_is_spectator := false;
    v_parent_id := NEW.event_id;
  END IF;

  -- Serialize participant/spectator inserts for this member + event pair.
  PERFORM pg_advisory_xact_lock(hashtext('participant_spectator:' || NEW.member_id::text || ':' || v_parent_id::text));

  IF v_is_spectator AND EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.member_id = NEW.member_id AND a.event_id = v_parent_id
  ) THEN
    RAISE EXCEPTION 'Already checked in as a participant, so cannot also check in as a spectator.'
      USING ERRCODE = 'CSA01';
  END IF;

  IF NOT v_is_spectator AND EXISTS (
    SELECT 1 FROM public.attendance a
    WHERE a.member_id = NEW.member_id AND a.event_id = v_spectator_id
  ) THEN
    RAISE EXCEPTION 'This member is checked in as a spectator. Remove their spectator check-in first.'
      USING ERRCODE = 'CSA01';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.attendance_block_participant_spectator() IS
  'Blocks a member from being both a participant (parent event) and a spectator (linked child event). Raises SQLSTATE CSA01.';

REVOKE ALL ON FUNCTION public.attendance_block_participant_spectator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attendance_block_participant_spectator() TO authenticated;

DROP TRIGGER IF EXISTS attendance_block_participant_spectator ON public.attendance;
CREATE TRIGGER attendance_block_participant_spectator
  BEFORE INSERT OR UPDATE OF member_id, event_id ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.attendance_block_participant_spectator();
