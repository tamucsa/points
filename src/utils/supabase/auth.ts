import { cache } from 'react'
import { createServerSupabase } from '@/utils/supabase/server'

export const getAuthUser = cache(async () => {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
})

export const getCurrentMember = cache(async () => {
  const { supabase, user } = await getAuthUser()

  if (!user) {
    return { supabase, user: null, member: null }
  }

  const { data: member } = await supabase
    .from('members')
    .select('id, full_name, role, status, profile_image_url')
    .eq('auth_uid', user.id)
    .maybeSingle()

  const avatarFromAuth = user.user_metadata?.avatar_url as string | undefined
  const memberWithAvatar = member
    ? {
        ...member,
        profile_image_url: member.profile_image_url ?? avatarFromAuth ?? null,
      }
    : null

  return { supabase, user, member: memberWithAvatar }
})

export const getActiveSemester = cache(async () => {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle()

  return data
})
