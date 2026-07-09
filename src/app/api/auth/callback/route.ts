import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function safeNextPath(next: string | null, origin: string): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  try {
    const url = new URL(next, origin)
    if (url.origin !== origin) return null
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'), origin)

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

    if (error || !user) {
      return NextResponse.redirect(`${origin}/?error=auth_failed`)
    }

    if (!user.email?.endsWith('@tamu.edu')) {
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

    if (member && !member.auth_uid) {
      await supabaseAdmin
        .from('members')
        .update({ auth_uid: user.id })
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
