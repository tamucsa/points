-- Jiating Mixer: 3 points when every active Jiating participates (6-way), else 2.
-- Updating events.point_value retriggers semester totals and the weekly JT cap.

UPDATE public.events e
SET point_value = 3
WHERE e.category IN ('Jiating Mixer', 'Mixer')
  AND e.point_value IS DISTINCT FROM 3
  AND (
    SELECT count(*) FROM public.jt_families j WHERE j.is_active
  ) = 6
  AND NOT EXISTS (
    SELECT 1
    FROM public.jt_families j
    WHERE j.is_active
      AND NOT EXISTS (
        SELECT 1
        FROM public.event_jt_families f
        WHERE f.event_id = e.id
          AND f.jt_family_id = j.id
      )
  );

UPDATE public.events e
SET point_value = 2
WHERE e.category IN ('Jiating Mixer', 'Mixer')
  AND e.point_value IS DISTINCT FROM 2
  AND (
    SELECT count(*) FROM public.jt_families j WHERE j.is_active
  ) = 6
  AND EXISTS (
    SELECT 1
    FROM public.jt_families j
    WHERE j.is_active
      AND NOT EXISTS (
        SELECT 1
        FROM public.event_jt_families f
        WHERE f.event_id = e.id
          AND f.jt_family_id = j.id
      )
  );
