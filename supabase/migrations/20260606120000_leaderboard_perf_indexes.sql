-- Speed up leaderboard view aggregations at ~300 members
CREATE INDEX IF NOT EXISTS idx_attendance_member_semester
  ON public.attendance (member_id, semester_id);

CREATE INDEX IF NOT EXISTS idx_attendance_event_id
  ON public.attendance (event_id);

CREATE INDEX IF NOT EXISTS idx_members_status_active
  ON public.members (status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_members_jt_family_id
  ON public.members (jt_family_id)
  WHERE status = 'active';
