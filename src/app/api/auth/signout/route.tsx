import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
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

  // Local scope clears cookies even when the refresh token is already invalid/revoked.
  await supabase.auth.signOut({ scope: 'local' })

  const response = NextResponse.redirect(new URL('/', request.url))
  for (const cookie of cookieStore.getAll()) {
    if (
      cookie.name.startsWith('sb-') &&
      (cookie.name.includes('auth-token') || cookie.name.includes('refresh-token'))
    ) {
      response.cookies.set(cookie.name, '', { path: '/', maxAge: 0 })
    }
  }
  return response
}
