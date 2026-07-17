-- Allow point_value = 0 for variable / manual-points events (base is unused; awards use override).
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_point_value_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_point_value_check
  CHECK (point_value = ANY (ARRAY[0, 1, 2, 3]));

UPDATE public.events
SET point_value = 0
WHERE check_in_type = 'manual_points'
  AND point_value IS DISTINCT FROM 0;
