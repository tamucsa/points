CREATE TABLE public.jt_transfer_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  from_jt_family_id uuid REFERENCES public.jt_families(id) ON DELETE SET NULL,
  to_jt_family_id uuid NOT NULL REFERENCES public.jt_families(id) ON DELETE RESTRICT,
  semester_id uuid REFERENCES public.semesters(id) ON DELETE SET NULL,
  import_batch_id uuid NOT NULL,
  imported_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jt_transfer_log_member_id ON public.jt_transfer_log (member_id);
CREATE INDEX idx_jt_transfer_log_semester_id ON public.jt_transfer_log (semester_id);
CREATE INDEX idx_jt_transfer_log_import_batch_id ON public.jt_transfer_log (import_batch_id);

ALTER TABLE public.jt_transfer_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read jt_transfer_log"
  ON public.jt_transfer_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.auth_uid = auth.uid() AND m.role = 'admin'
    )
  );
