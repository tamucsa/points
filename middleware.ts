import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const publicRoutes = [
  '/register',
  '/pending',
  '/api/auth',
  '/api/cron',
  '/checkin',
  '/privacy',
  '/terms',
  '/login',
]

function clearAuthCookies(response: NextResponse, request: NextRequest) {
  for (const cookie of request.cookies.getAll()) {
    if (
      cookie.name.startsWith('sb-') &&
      (cookie.name.includes('auth-token') || cookie.name.includes('refresh-token'))
    ) {
      response.cookies.set(cookie.name, '', {
        path: '/',
        maxAge: 0,
      })
    }
  }
}

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

  // Required for @supabase/ssr cookie refresh; do not query members here (layouts load status).
  const { data: { user }, error } = await supabase.auth.getUser()

  // Stale cookies after revoked/deleted sessions throw refresh_token_not_found.
  // Clear them so the user can sign in again instead of looping on a dead session.
  if (error && !user) {
    clearAuthCookies(supabaseResponse, request)
  }

  const isPublicRoute =
    pathname === '/' ||
    publicRoutes.some(r =>
      r === '/checkin'
        ? pathname === '/checkin' || pathname.startsWith('/checkin/')
        : pathname === r || pathname.startsWith(`${r}/`),
    )

  if (!user && !isPublicRoute) {
    const redirect = NextResponse.redirect(new URL('/', request.url))
    if (error) clearAuthCookies(redirect, request)
    return redirect
  }

  if (user && (pathname === '/' || pathname.startsWith('/login'))) {
    return NextResponse.redirect(new URL('/leaderboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
