/** Public site when request headers only expose the internal server address. */
export const DEFAULT_SITE_ORIGIN = "https://points.csatamu.org";

function firstHeader(value: string | null | undefined): string | null {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

function hostnameOf(host: string): string {
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end === -1 ? host : host.slice(1, end);
  }
  return host.split(":")[0] ?? host;
}

export function isLoopbackHost(host: string): boolean {
  const hostname = hostnameOf(host);
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1"
  );
}

/** Configured public origin, ignoring a localhost site URL. */
export function configuredSiteOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (isLoopbackHost(url.host)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Origin for absolute redirects and QR links.
 * Route handlers on Vercel see `request.url` as http://localhost:3000 because
 * that is the internal bind address. Prefer the forwarded public host.
 */
export function publicOrigin(input: {
  requestUrl?: string | null;
  forwardedHost?: string | null;
  forwardedProto?: string | null;
  host?: string | null;
}): string {
  const forwardedHost = firstHeader(input.forwardedHost);
  const host = firstHeader(input.host);
  const proto = firstHeader(input.forwardedProto);
  const candidates = [forwardedHost, host].filter((value): value is string =>
    Boolean(value),
  );
  const publicHost = candidates.find((value) => !isLoopbackHost(value));

  if (publicHost) {
    const scheme = proto === "http" || proto === "https" ? proto : "https";
    return `${scheme}://${publicHost}`;
  }

  const site = configuredSiteOrigin();
  if (process.env.NODE_ENV === "production") {
    return site ?? DEFAULT_SITE_ORIGIN;
  }

  if (input.requestUrl) {
    try {
      return new URL(input.requestUrl).origin;
    } catch {
      // Fall through to the host header.
    }
  }

  const loopbackHost = candidates[0];
  if (loopbackHost) {
    const scheme = proto === "http" || proto === "https" ? proto : "http";
    return `${scheme}://${loopbackHost}`;
  }

  return site ?? DEFAULT_SITE_ORIGIN;
}

export function publicOriginFromRequest(request: Request): string {
  return publicOrigin({
    requestUrl: request.url,
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    host: request.headers.get("host"),
  });
}
