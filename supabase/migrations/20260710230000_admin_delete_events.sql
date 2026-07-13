-- Admin-only event deletion (officers cannot delete events).

CREATE POLICY "Admin can delete events"
  ON public.events FOR DELETE
  USING (get_my_role() = 'admin'::member_role);
