import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { AUTH_NEXT_COOKIE, safeNextPath } from '@/utils/auth-next'
import { isAllowedSchoolEmail } from '@/utils/email'
import { publicOriginFromRequest } from '@/utils/public-origin'
import { fetchWithAuthTimeout } from '@/utils/supabase/auth-request'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const origin = publicOriginFromRequest(request)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const next = safeNextPath(
      cookieStore.get(AUTH_NEXT_COOKIE)?.value ?? searchParams.get('next'),
      origin,
    )
    cookieStore.set(AUTH_NEXT_COOKIE, '', { path: '/', maxAge: 0 })
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
        global: { fetch: fetchWithAuthTimeout },
      }
    )

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error || !user) {
      return NextResponse.redirect(`${origin}/?error=auth_failed`)
    }

    if (!isAllowedSchoolEmail(user.email)) {
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/?error=invalid_domain`)
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: memberByAuthUid } = await supabaseAdmin
      .from('members')
      .select('id, status, auth_uid')
      .eq('auth_uid', user.id)
      .maybeSingle()

    const { data: memberByEmail } = await supabaseAdmin
      .from('members')
      .select('id, status, auth_uid')
      .ilike('email', user.email ?? '')
      .maybeSingle()

    const member = memberByAuthUid ?? memberByEmail

    const avatarUrl = user.user_metadata?.avatar_url as string | undefined

    if (member && !member.auth_uid) {
      await supabaseAdmin
        .from('members')
        .update({
          auth_uid: user.id,
          ...(avatarUrl ? { profile_image_url: avatarUrl } : {}),
        })
        .eq('id', member.id)

      if (next && member.status === 'active') {
        return NextResponse.redirect(`${origin}${next}`)
      }

      return NextResponse.redirect(
        member.status === 'active'
          ? `${origin}/leaderboard`
          : `${origin}/pending`
      )
    }

    if (member && avatarUrl) {
      await supabaseAdmin
        .from('members')
        .update({ profile_image_url: avatarUrl })
        .eq('id', member.id)
    }

    if (!member) {
      return NextResponse.redirect(`${origin}/register`)
    }

    if (next && member.status === 'active') {
      return NextResponse.redirect(`${origin}${next}`)
    }

    return NextResponse.redirect(
      member.status === 'active'
        ? `${origin}/leaderboard`
        : `${origin}/pending`
    )
  }

  return NextResponse.redirect(`${origin}/?error=auth_failed`)
}
