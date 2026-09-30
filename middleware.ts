import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  fetchWithAuthTimeout,
  isTransientAuthError,
} from '@/utils/supabase/auth-request'

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
      global: { fetch: fetchWithAuthTimeout },
    }
  )

  // Required for @supabase/ssr cookie refresh; do not query members here (layouts load status).
  let user: { id: string } | null = null
  let error: { name?: string; status?: number } | null = null
  try {
    const result = await supabase.auth.getUser()
    user = result.data.user
    error = result.error
  } catch (caught) {
    console.error(caught)
    error = { name: 'AuthRetryableFetchError', status: 0 }
  }

  // Only wipe cookies for a revoked session. A 504 or timeout must leave them
  // in place so the member is signed in again once Auth recovers.
  const sessionIsDead = Boolean(error) && !user && !isTransientAuthError(error)
  if (sessionIsDead) {
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
    if (sessionIsDead) clearAuthCookies(redirect, request)
    return redirect
  }

  if (user && (pathname === '/' || pathname.startsWith('/login'))) {
    return NextResponse.redirect(new URL('/leaderboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Sentry tunnel, Next.js internals, and public static files (logos, fonts, etc.)
    '/((?!monitoring|_next/static|_next/image|favicon.ico|[^?]*\\.(?:svg|png|jpe?g|gif|webp|ico|woff2?)).*)',
  ],
}
