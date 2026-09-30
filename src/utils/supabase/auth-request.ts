/** Bound Auth API calls so a stalled GoTrue service cannot hold a request open. */
export const AUTH_FETCH_TIMEOUT_MS = 4_000;

type AuthErrorLike = {
  name?: string;
  status?: number;
};

/**
 * Abort only Auth API calls. Database queries keep their own deadlines.
 * A hung `getUser()` in middleware is what took the site down: Vercel stops
 * middleware that has not responded within 25s.
 */
export function fetchWithAuthTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (!url.includes("/auth/v1/")) {
    return fetch(input, init);
  }

  const timeout = AbortSignal.timeout(AUTH_FETCH_TIMEOUT_MS);
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;

  return fetch(input, { ...init, signal });
}

/**
 * Network and gateway failures are temporary. Dead refresh tokens are not.
 * Transient errors must keep the session cookies so the next request can succeed.
 */
export function isTransientAuthError(error: AuthErrorLike | null): boolean {
  if (!error) return false;
  if (error.name === "AuthRetryableFetchError") return true;
  const status = error.status ?? 0;
  return status === 0 || status >= 500;
}
