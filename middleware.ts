import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicRoutes = ['/register', '/pending', '/api/auth', '/checkin', '/privacy', '/terms', '/login']

const pendingAllowedRoutes = ['/pending', '/register', '/api/auth', '/checkin']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const pathname = request.nextUrl.pathname

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

  const isPublicRoute =
    pathname === '/' ||
    publicRoutes.some(r =>
      r === '/checkin'
        ? pathname === '/checkin' || pathname.startsWith('/checkin/')
        : pathname === r || pathname.startsWith(`${r}/`),
    )

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  let member: { status: string } | null = null

  if (user) {
    const { data } = await supabase
      .from('members')
      .select('status')
      .eq('auth_uid', user.id)
      .maybeSingle()

    member = data
  }

  if (user && member?.status === 'pending_jt') {
    const isPendingAllowed = pendingAllowedRoutes.some(r => pathname.startsWith(r))
    if (!isPendingAllowed) {
      return NextResponse.redirect(new URL('/pending', request.url))
    }
  }

  if (user && pathname.startsWith('/pending') && member?.status === 'active') {
    return NextResponse.redirect(new URL('/leaderboard', request.url))
  }

  if (user && (pathname === '/' || pathname.startsWith('/login'))) {
    const dest = member?.status === 'pending_jt' ? '/pending' : '/leaderboard'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
