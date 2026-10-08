import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  AUTH_NEXT_COOKIE,
  AUTH_NEXT_MAX_AGE_SECONDS,
  safeNextPath,
} from "@/utils/auth-next";
import { publicOriginFromRequest } from "@/utils/public-origin";
import { fetchWithAuthTimeout } from "@/utils/supabase/auth-request";

/**
 * Starts Google OAuth via a same-tab HTTP redirect chain:
 * /api/auth/google → Supabase authorize URL → Google → /api/auth/callback
 *
 * Prefer this over client-side `signInWithOAuth` after `await`, which some browsers
 * (notably Arc) promote into a second tab once the user-gesture window has expired.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const origin = publicOriginFromRequest(request);
  const next = safeNextPath(searchParams.get("next"), origin);

  // Keep this URL exact. Supabase only allows the bare callback; a ?next=
  // query is ignored and the login code is sent to the project Site URL.
  const callbackUrl = `${origin}/api/auth/callback`;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
      global: { fetch: fetchWithAuthTimeout },
    },
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
      // Google's `hd` hint accepts one hosted domain. Omitting it lets both
      // @tamu.edu and @buc.blinn.edu accounts appear. The callback enforces
      // the allowlist.
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  if (next) {
    cookieStore.set(AUTH_NEXT_COOKIE, next, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: AUTH_NEXT_MAX_AGE_SECONDS,
    });
  } else {
    cookieStore.set(AUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
  }

  return NextResponse.redirect(data.url);
}
