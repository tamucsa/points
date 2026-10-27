-- Battle pass rewards belong to a semester. New semesters start with the
-- default set; admins edit names and point thresholds afterward.
-- Keep the default names and points in sync with DEFAULT_BATTLE_PASS_REWARDS
-- in src/utils/battle-pass.ts.

CREATE TABLE public.battle_pass_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters (id) ON DELETE CASCADE,
  name text NOT NULL,
  points_required smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT battle_pass_rewards_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT battle_pass_rewards_points_range CHECK (points_required >= 0 AND points_required <= 10000)
);

CREATE UNIQUE INDEX battle_pass_rewards_semester_name_uidx
  ON public.battle_pass_rewards (semester_id, lower(btrim(name)));

CREATE INDEX idx_battle_pass_rewards_semester_points
  ON public.battle_pass_rewards (semester_id, points_required);

COMMENT ON TABLE public.battle_pass_rewards IS
  'Semester battle pass catalog. A dues-paying member unlocks a row when their semester points reach points_required.';

CREATE TABLE public.battle_pass_pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_id uuid NOT NULL REFERENCES public.battle_pass_rewards (id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members (id) ON DELETE CASCADE,
  picked_up_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES public.members (id) ON DELETE SET NULL,
  CONSTRAINT battle_pass_pickups_reward_member_key UNIQUE (reward_id, member_id)
);

CREATE INDEX idx_battle_pass_pickups_member
  ON public.battle_pass_pickups (member_id);

COMMENT ON TABLE public.battle_pass_pickups IS
  'Officer record that a member has claimed a battle pass reward. Eligibility is enforced on insert.';

CREATE OR REPLACE FUNCTION public.normalize_battle_pass_reward()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.name := btrim(regexp_replace(NEW.name, '\s+', ' ', 'g'));
  IF NEW.name = '' THEN
    RAISE EXCEPTION 'Reward name is required.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS battle_pass_rewards_normalize ON public.battle_pass_rewards;
CREATE TRIGGER battle_pass_rewards_normalize
  BEFORE INSERT OR UPDATE OF name
  ON public.battle_pass_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_battle_pass_reward();

REVOKE ALL ON FUNCTION public.normalize_battle_pass_reward() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_battle_pass_reward() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.seed_battle_pass_rewards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.battle_pass_rewards (semester_id, name, points_required)
  VALUES
    (NEW.id, 'CSA Sticker', 20),
    (NEW.id, 'Free Boba', 40),
    (NEW.id, 'Past Merch', 50),
    (NEW.id, 'Pie an Officer/Parent', 70),
    (NEW.id, 'Blindbox', 90);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.seed_battle_pass_rewards() IS
  'Inserts the default battle pass when a semester is created.';

REVOKE ALL ON FUNCTION public.seed_battle_pass_rewards() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_battle_pass_rewards() TO service_role;

DROP TRIGGER IF EXISTS semesters_seed_battle_pass_rewards ON public.semesters;
CREATE TRIGGER semesters_seed_battle_pass_rewards
  AFTER INSERT ON public.semesters
  FOR EACH ROW
  EXECUTE FUNCTION public.seed_battle_pass_rewards();

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
  v_role public.member_role;
  v_parent boolean;
  v_status public.member_status;
BEGIN
  IF NOT public.is_officer_or_parent() THEN
    RAISE EXCEPTION 'Officer access required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.points_required, r.semester_id
  INTO v_required, v_semester
  FROM public.battle_pass_rewards r
  WHERE r.id = NEW.reward_id;

  IF v_semester IS NULL THEN
    RAISE EXCEPTION 'Reward not found.';
  END IF;

  SELECT m.role, COALESCE(m.is_parent, false), m.status
  INTO v_role, v_parent, v_status
  FROM public.members m
  WHERE m.id = NEW.member_id;

  IF v_role IS NULL
     OR v_status IS DISTINCT FROM 'active'::public.member_status
     OR v_role IS DISTINCT FROM 'member'::public.member_role
     OR v_parent THEN
    RAISE EXCEPTION 'Only active dues-paying members can pick up battle pass rewards.';
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
  'Officers can record a pickup only after the member has enough points for that semester reward.';

REVOKE ALL ON FUNCTION public.enforce_battle_pass_pickup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_battle_pass_pickup() TO authenticated;

DROP TRIGGER IF EXISTS battle_pass_pickups_enforce ON public.battle_pass_pickups;
CREATE TRIGGER battle_pass_pickups_enforce
  BEFORE INSERT ON public.battle_pass_pickups
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_battle_pass_pickup();

ALTER TABLE public.battle_pass_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_pass_pickups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.battle_pass_rewards FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.battle_pass_pickups FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.battle_pass_rewards TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.battle_pass_pickups TO authenticated;
GRANT ALL ON TABLE public.battle_pass_rewards TO service_role;
GRANT ALL ON TABLE public.battle_pass_pickups TO service_role;

DROP POLICY IF EXISTS members_read_battle_pass_rewards ON public.battle_pass_rewards;
CREATE POLICY members_read_battle_pass_rewards
  ON public.battle_pass_rewards
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS officers_read_battle_pass_pickups ON public.battle_pass_pickups;
CREATE POLICY officers_read_battle_pass_pickups
  ON public.battle_pass_pickups
  FOR SELECT
  TO authenticated
  USING (public.is_officer_or_parent());

DROP POLICY IF EXISTS members_read_own_battle_pass_pickups ON public.battle_pass_pickups;
CREATE POLICY members_read_own_battle_pass_pickups
  ON public.battle_pass_pickups
  FOR SELECT
  TO authenticated
  USING (
    member_id = (
      SELECT m.id
      FROM public.members m
      WHERE m.auth_uid = auth.uid()
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS officers_insert_battle_pass_pickups ON public.battle_pass_pickups;
CREATE POLICY officers_insert_battle_pass_pickups
  ON public.battle_pass_pickups
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_officer_or_parent());

DROP POLICY IF EXISTS officers_delete_battle_pass_pickups ON public.battle_pass_pickups;
CREATE POLICY officers_delete_battle_pass_pickups
  ON public.battle_pass_pickups
  FOR DELETE
  TO authenticated
  USING (public.is_officer_or_parent());

INSERT INTO public.battle_pass_rewards (semester_id, name, points_required)
SELECT s.id, v.name, v.points
FROM public.semesters s
CROSS JOIN (
  VALUES
    ('CSA Sticker'::text, 20::smallint),
    ('Free Boba', 40),
    ('Past Merch', 50),
    ('Pie an Officer/Parent', 70),
    ('Blindbox', 90)
) AS v(name, points)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.battle_pass_rewards existing
  WHERE existing.semester_id = s.id
);
