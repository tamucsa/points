-- Ensure school year labels stay unique for upsert-by-name on semester start.
CREATE UNIQUE INDEX IF NOT EXISTS years_name_key ON public.years (name);
