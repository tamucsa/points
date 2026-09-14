-- Classification (members.graduation_year) was an integer graduation year.
-- Store it as text so "Graduate Student" is a valid value alongside years like "2027".

ALTER TABLE public.members
  ALTER COLUMN graduation_year TYPE text
  USING graduation_year::text;
