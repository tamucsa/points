-- Allow admins to bulk-import roster members as active with Jiating assigned.

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
        AND jt_family_id IS NOT NULL
        AND role = 'member'::member_role
      )
    )
  );
