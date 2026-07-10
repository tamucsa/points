REVOKE EXECUTE ON FUNCTION public.close_semester(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.close_semester(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_semester(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.close_semester(uuid) TO service_role;

ALTER FUNCTION public.get_my_role() SET search_path = public;
ALTER FUNCTION public.get_my_jt_family_id() SET search_path = public;
ALTER FUNCTION public.close_semester(uuid) SET search_path = public;

CREATE POLICY "Members can view own row"
  ON public.members FOR SELECT
  USING (auth_uid = auth.uid());

DROP POLICY IF EXISTS "Officers can update any member" ON public.members;

CREATE POLICY "Admin can update any member"
  ON public.members FOR UPDATE
  USING (get_my_role() = 'admin'::member_role)
  WITH CHECK (get_my_role() = 'admin'::member_role);

CREATE POLICY "Officers can update member profiles"
  ON public.members FOR UPDATE
  USING (get_my_role() = 'officer'::member_role)
  WITH CHECK (
    get_my_role() = 'officer'::member_role
    AND role = (SELECT m.role FROM public.members m WHERE m.id = members.id)
    AND status = (SELECT m.status FROM public.members m WHERE m.id = members.id)
    AND jt_family_id IS NOT DISTINCT FROM (SELECT m.jt_family_id FROM public.members m WHERE m.id = members.id)
  );

CREATE POLICY "Admin can import members"
  ON public.members FOR INSERT
  WITH CHECK (
    get_my_role() = 'admin'::member_role
    AND auth_uid IS NULL
    AND status = 'pending_jt'::member_status
  );

DROP POLICY IF EXISTS "All active members can view org and jt_shared events" ON public.events;
DROP POLICY IF EXISTS "Members can view their own JT events" ON public.events;

CREATE POLICY "Active members can view org and jt_shared events"
  ON public.events FOR SELECT
  USING (
    scope = ANY (ARRAY['org'::event_scope, 'jt_shared'::event_scope])
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.auth_uid = auth.uid() AND m.status = 'active'::member_status
    )
  );

CREATE POLICY "Active members can view their JT events"
  ON public.events FOR SELECT
  USING (
    scope = 'jt_specific'::event_scope
    AND jt_family_id = get_my_jt_family_id()
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.auth_uid = auth.uid() AND m.status = 'active'::member_status
    )
  );

CREATE POLICY "Officers can view all events"
  ON public.events FOR SELECT
  USING (get_my_role() = ANY (ARRAY['officer'::member_role, 'admin'::member_role]));

CREATE POLICY "Anyone can read years"
  ON public.years FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read semester_families"
  ON public.semester_families FOR SELECT
  USING (true);
