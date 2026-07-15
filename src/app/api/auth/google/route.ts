import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function safeNextPath(next: string | null, origin: string): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/**
 * Starts Google OAuth via a same-tab HTTP redirect chain:
 * /api/auth/google → Supabase authorize URL → Google → /api/auth/callback
 *
 * Prefer this over client-side `signInWithOAuth` after `await`, which some browsers
 * (notably Arc) promote into a second tab once the user-gesture window has expired.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNextPath(searchParams.get("next"), origin);

  const callbackUrl = next
    ? `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`
    : `${origin}/api/auth/callback`;

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
    },
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl,
      queryParams: { hd: "tamu.edu" },
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  return NextResponse.redirect(data.url);
}
