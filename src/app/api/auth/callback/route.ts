import { createServerClient } from '@supabase/ssr'
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

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, status, auth_uid')
      .eq('email', user.email)
      .single()

    console.log('member:', member)
    console.log('member error:', memberError)

    if (member && !member.auth_uid) {
      await supabase
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

    return NextResponse.redirect(`${origin}/leaderboard`)
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}