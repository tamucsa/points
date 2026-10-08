/** Short-lived cookie that returns a member to the page they opened before Google sign-in. */
export const AUTH_NEXT_COOKIE = "csa-auth-next";

export const AUTH_NEXT_MAX_AGE_SECONDS = 60 * 10;

/**
 * Relative in-app path only. Supabase allowlists the callback URL exactly, so
 * this path cannot be appended as a query string on redirectTo.
 */
export function safeNextPath(next: string | null, origin: string): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  try {
    const url = new URL(next, origin);
    if (url.origin !== origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
