-- Self-registered users gate on pending_member; roster imports stay active.

UPDATE public.members
SET status = 'pending_member'
WHERE status = 'pending_jt';

DROP POLICY IF EXISTS "Anyone can insert own member row on registration" ON public.members;
CREATE POLICY "Anyone can insert own member row on registration"
  ON public.members
  FOR INSERT
  WITH CHECK (
    auth_uid = auth.uid()
    AND role = 'member'::member_role
    AND status = 'pending_member'::member_status
  );

DROP POLICY IF EXISTS "Admin can import members" ON public.members;
CREATE POLICY "Admin can import members"
  ON public.members FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'::member_role
    AND auth_uid IS NULL
    AND (
      status = 'pending_member'::member_status
      OR status = 'pending_jt'::member_status
      OR (
        status = 'active'::member_status
        AND role = 'member'::member_role
      )
    )
  );
