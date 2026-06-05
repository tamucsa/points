import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
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
      }
    )

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

    console.log('user email:', user?.email)
    console.log('auth error:', error)

    if (!user?.email?.endsWith('@tamu.edu')) {
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/login?error=invalid_domain`)
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: memberByAuthUid, error: memberByAuthUidError } = await supabaseAdmin
      .from('members')
      .select('id, status, auth_uid')
      .eq('auth_uid', user.id)
      .maybeSingle()

    const { data: memberByEmail, error: memberByEmailError } = await supabaseAdmin
      .from('members')
      .select('id, status, auth_uid')
      .ilike('email', user.email ?? '')
      .maybeSingle()

    const member = memberByAuthUid ?? memberByEmail
    const memberError = memberByAuthUidError ?? memberByEmailError

    console.log('member:', member)
    console.log('member error:', memberError)

    if (member && !member.auth_uid) {
      await supabaseAdmin
        .from('members')
        .update({ auth_uid: user.id })
        .eq('id', member.id)

      return NextResponse.redirect(
        member.status === 'active'
          ? `${origin}/leaderboard`
          : `${origin}/pending`
      )
    }

    if (!member) {
      return NextResponse.redirect(`${origin}/register`)
    }

    return NextResponse.redirect(
      member.status === 'active'
        ? `${origin}/leaderboard`
        : `${origin}/pending`
    )
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}