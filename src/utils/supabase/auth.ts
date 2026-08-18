import { cache } from "react";
import { setSentryUser } from "@/utils/sentry";
import { createServerSupabase } from "@/utils/supabase/server";

export const getAuthUser = cache(async () => {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});

export const getCurrentMember = cache(async () => {
  const { supabase, user } = await getAuthUser();

  if (!user) {
    setSentryUser(null);
    return { supabase, user: null, member: null };
  }

  // Keep theme_preference optional so a missing migration cannot blank the member
  // row and bounce authenticated users between /register and /leaderboard.
  const { data: member, error } = await supabase
    .from("members")
    .select(
      "id, full_name, role, status, profile_image_url, graduation_year, jt_family_id, theme_preference",
    )
    .eq("auth_uid", user.id)
    .maybeSingle();

  if (error) {
    const { data: fallbackMember } = await supabase
      .from("members")
      .select(
        "id, full_name, role, status, profile_image_url, graduation_year, jt_family_id",
      )
      .eq("auth_uid", user.id)
      .maybeSingle();

    const avatarFromAuth = user.user_metadata?.avatar_url as string | undefined;
    const memberWithAvatar = fallbackMember
      ? {
          ...fallbackMember,
          theme_preference: "system" as const,
          profile_image_url:
            fallbackMember.profile_image_url ?? avatarFromAuth ?? null,
        }
      : null;

    setSentryUser(memberWithAvatar);
    return { supabase, user, member: memberWithAvatar };
  }

  const avatarFromAuth = user.user_metadata?.avatar_url as string | undefined;
  const memberWithAvatar = member
    ? {
        ...member,
        theme_preference: member.theme_preference ?? "system",
        profile_image_url: member.profile_image_url ?? avatarFromAuth ?? null,
      }
    : null;

  setSentryUser(memberWithAvatar);
  return { supabase, user, member: memberWithAvatar };
});

export const getActiveSemester = cache(async () => {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("semesters")
    .select("id, name")
    .eq("is_active", true)
    .maybeSingle();

  return data;
});
