import { afterEach, describe, expect, it, vi } from "vitest";
import { publicOrigin } from "@/utils/public-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("publicOrigin", () => {
  it("uses the forwarded public host when the request URL is localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      publicOrigin({
        requestUrl: "http://localhost:3000/api/auth/callback?next=%2Fcheckin%2Fcode",
        forwardedHost: "points.csatamu.org",
        forwardedProto: "https",
        host: "localhost:3000",
      }),
    ).toBe("https://points.csatamu.org");
  });

  it("does not send production redirects to a localhost site URL", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    expect(
      publicOrigin({
        requestUrl: "http://localhost:3000/api/auth/callback",
        host: "localhost:3000",
      }),
    ).toBe("https://points.csatamu.org");
  });

  it("keeps local development on localhost", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      publicOrigin({
        requestUrl: "http://localhost:3000/api/auth/google",
        host: "localhost:3000",
      }),
    ).toBe("http://localhost:3000");
  });
});
