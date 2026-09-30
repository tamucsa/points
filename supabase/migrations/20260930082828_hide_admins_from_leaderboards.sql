-- Admins keep earned points. They are omitted from the Overall ranking
-- and from each Jiating's top-member list, same as officers.

CREATE OR REPLACE FUNCTION public.top_leaderboard_members_per_jt(p_limit integer DEFAULT 3)
RETURNS TABLE (
  id uuid,
  full_name text,
  profile_image_url text,
  jt_family text,
  jt_color text,
  total_points smallint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    ranked.id,
    ranked.full_name,
    ranked.profile_image_url,
    ranked.jt_family,
    ranked.jt_color,
    ranked.total_points
  FROM (
    SELECT
      v.id,
      v.full_name,
      v.profile_image_url,
      v.jt_family,
      v.jt_color,
      v.total_points,
      row_number() OVER (
        PARTITION BY v.jt_family
        ORDER BY v.total_points DESC, v.full_name ASC
      ) AS rn
    FROM public.v_current_leaderboard v
    WHERE v.jt_family IS NOT NULL
      AND COALESCE(v.is_parent, false) = false
      AND v.role IS DISTINCT FROM 'parent'::public.member_role
      AND v.role IS DISTINCT FROM 'officer'::public.member_role
      AND v.role IS DISTINCT FROM 'admin'::public.member_role
  ) ranked
  WHERE ranked.rn <= GREATEST(COALESCE(p_limit, 3), 1);
$$;

COMMENT ON FUNCTION public.top_leaderboard_members_per_jt(integer) IS
  'Returns up to p_limit non-staff, point-earning members per Jiating from v_current_leaderboard.';

REVOKE ALL ON FUNCTION public.top_leaderboard_members_per_jt(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.top_leaderboard_members_per_jt(integer) TO authenticated;
