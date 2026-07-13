CREATE POLICY "Officers can delete event jt families"
  ON public.event_jt_families FOR DELETE
  USING (get_my_role() = ANY (ARRAY['officer'::member_role, 'admin'::member_role]));
