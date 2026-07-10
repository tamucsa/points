-- Bi-weekly Jiating standings snapshots (published by officers after GM).

CREATE TABLE public.jt_leaderboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  source_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  label text,
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_jt_leaderboard_snapshots_event
  ON public.jt_leaderboard_snapshots (source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE INDEX idx_jt_leaderboard_snapshots_semester
  ON public.jt_leaderboard_snapshots (semester_id, snapshot_at DESC);

CREATE TABLE public.jt_leaderboard_snapshot_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES public.jt_leaderboard_snapshots(id) ON DELETE CASCADE,
  jt_family_id uuid REFERENCES public.jt_families(id) ON DELETE SET NULL,
  jt_family_name text NOT NULL,
  jt_color text,
  member_count smallint NOT NULL DEFAULT 0,
  total_points smallint NOT NULL DEFAULT 0,
  avg_points_per_member numeric(6, 1),
  rank smallint NOT NULL,
  UNIQUE (snapshot_id, jt_family_id)
);

CREATE INDEX idx_jt_leaderboard_snapshot_rows_snapshot
  ON public.jt_leaderboard_snapshot_rows (snapshot_id, rank);

ALTER TABLE public.jt_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jt_leaderboard_snapshot_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active members can read jt leaderboard snapshots"
  ON public.jt_leaderboard_snapshots
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.auth_uid = auth.uid() AND m.status = 'active'::member_status
    )
  );

CREATE POLICY "Active members can read jt leaderboard snapshot rows"
  ON public.jt_leaderboard_snapshot_rows
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.auth_uid = auth.uid() AND m.status = 'active'::member_status
    )
  );
