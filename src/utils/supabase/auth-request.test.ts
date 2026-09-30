import { describe, expect, it } from "vitest";
import { isTransientAuthError } from "@/utils/supabase/auth-request";

describe("isTransientAuthError", () => {
  it("keeps the session when Auth is unreachable", () => {
    expect(
      isTransientAuthError({ name: "AuthRetryableFetchError", status: 504 }),
    ).toBe(true);
    expect(
      isTransientAuthError({ name: "AuthRetryableFetchError", status: 0 }),
    ).toBe(true);
    expect(isTransientAuthError({ status: 500 })).toBe(true);
    expect(isTransientAuthError({ status: 0 })).toBe(true);
  });

  it("treats a revoked or missing session as terminal", () => {
    expect(isTransientAuthError(null)).toBe(false);
    expect(isTransientAuthError({ name: "AuthApiError", status: 400 })).toBe(
      false,
    );
    expect(
      isTransientAuthError({ name: "AuthSessionMissingError", status: 400 }),
    ).toBe(false);
  });
});
