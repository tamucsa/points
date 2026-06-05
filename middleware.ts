import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicRoutes = ['/login', '/register', '/pending', '/api/auth', '/checkin']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isPublicRoute = publicRoutes.some(r => request.nextUrl.pathname.startsWith(r))

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && !isPublicRoute) {
    const { data: member } = await supabase
      .from('members')
      .select('status, auth_uid')
      .eq('auth_uid', user.id)
      .maybeSingle()

    if (request.nextUrl.pathname.startsWith('/leaderboard') && member?.status === 'pending_jt') {
      return NextResponse.redirect(new URL('/pending', request.url))
    }

    if (request.nextUrl.pathname.startsWith('/pending') && member?.status === 'active') {
      return NextResponse.redirect(new URL('/leaderboard', request.url))
    }
  }

  if (user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/leaderboard', request.url))
  }

  // CRITICAL — must return supabaseResponse, not NextResponse.next()
  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}