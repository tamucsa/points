CREATE POLICY "Officers can remove attendance"
  ON public.attendance FOR DELETE
  USING (get_my_role() = ANY (ARRAY['officer'::member_role, 'admin'::member_role]));
