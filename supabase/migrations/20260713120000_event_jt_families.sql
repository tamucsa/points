-- Families participating in a JT-shared event (Mixers: selected families;
-- Olympics typically omit rows and treat all active families as involved).

CREATE TABLE public.event_jt_families (
  event_id uuid NOT NULL REFERENCES public.events (id) ON DELETE CASCADE,
  jt_family_id uuid NOT NULL REFERENCES public.jt_families (id),
  PRIMARY KEY (event_id, jt_family_id)
);

CREATE INDEX idx_event_jt_families_jt_family_id
  ON public.event_jt_families (jt_family_id);

ALTER TABLE public.event_jt_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active members can view event jt families"
  ON public.event_jt_families FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.auth_uid = auth.uid()
        AND m.status = 'active'::member_status
    )
  );

CREATE POLICY "Officers can view event jt families"
  ON public.event_jt_families FOR SELECT
  USING (get_my_role() = ANY (ARRAY['officer'::member_role, 'admin'::member_role]));

CREATE POLICY "Officers can insert event jt families"
  ON public.event_jt_families FOR INSERT
  WITH CHECK (get_my_role() = ANY (ARRAY['officer'::member_role, 'admin'::member_role]));
