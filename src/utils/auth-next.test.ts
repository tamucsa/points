import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/utils/auth-next";

const origin = "https://points.csatamu.org";

describe("safeNextPath", () => {
  it("keeps an in-app check-in path", () => {
    expect(safeNextPath("/checkin/abc", origin)).toBe("/checkin/abc");
    expect(safeNextPath("/checkin/abc?from=qr", origin)).toBe(
      "/checkin/abc?from=qr",
    );
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("http://localhost:3000/checkin/abc", origin)).toBe(
      null,
    );
    expect(safeNextPath("//evil.example/checkin/abc", origin)).toBe(null);
    expect(safeNextPath(null, origin)).toBe(null);
  });
});
