ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'system'
  CHECK (theme_preference IN ('light', 'dark', 'system'));

COMMENT ON COLUMN public.members.theme_preference IS
  'User display theme: light, dark, or system (follows OS preference).';
