-- Allow admin roster import of active members before Jiating assignment.
DROP POLICY IF EXISTS "Admin can import members" ON public.members;

CREATE POLICY "Admin can import members"
  ON public.members FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'::member_role
    AND auth_uid IS NULL
    AND (
      status = 'pending_jt'::member_status
      OR (
        status = 'active'::member_status
        AND role = 'member'::member_role
      )
    )
  );
