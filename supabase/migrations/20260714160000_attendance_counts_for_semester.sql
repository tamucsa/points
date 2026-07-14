-- Per-event attendance counts for officer events list (avoid fetching all attendance rows).

CREATE INDEX IF NOT EXISTS idx_attendance_semester_event
  ON public.attendance (semester_id, event_id);

CREATE OR REPLACE FUNCTION public.attendance_counts_for_semester(p_semester_id uuid)
RETURNS TABLE(event_id uuid, attendance_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT a.event_id, count(*)::bigint AS attendance_count
  FROM public.attendance a
  WHERE a.semester_id = p_semester_id
  GROUP BY a.event_id;
$$;

COMMENT ON FUNCTION public.attendance_counts_for_semester(uuid) IS
  'Returns per-event attendance counts for a semester (officer Events list).';

REVOKE ALL ON FUNCTION public.attendance_counts_for_semester(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attendance_counts_for_semester(uuid) TO authenticated;
