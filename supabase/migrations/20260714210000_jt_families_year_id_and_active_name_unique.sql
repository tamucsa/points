-- Scope Jiatings to school years (Fall + Spring share the same families).
-- Allow the same theme / placeholder names across years via partial unique on active rows.

ALTER TABLE public.jt_families
  ADD COLUMN IF NOT EXISTS year_id uuid REFERENCES public.years (id);

-- Backfill year_id from the semester the family is currently linked to.
UPDATE public.jt_families jf
SET year_id = s.year_id
FROM public.semesters s
WHERE jf.semester = s.id
  AND jf.year_id IS NULL
  AND s.year_id IS NOT NULL;

ALTER TABLE public.jt_families
  DROP CONSTRAINT IF EXISTS jt_families_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS jt_families_active_name_key
  ON public.jt_families (name)
  WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_jt_families_year_id
  ON public.jt_families (year_id);
