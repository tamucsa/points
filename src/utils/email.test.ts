import { describe, expect, it } from "vitest";
import { isAllowedSchoolEmail } from "@/utils/email";

describe("isAllowedSchoolEmail", () => {
  it("accepts TAMU and Blinn BUC addresses", () => {
    expect(isAllowedSchoolEmail("ada@tamu.edu")).toBe(true);
    expect(isAllowedSchoolEmail("Ada@TAMU.EDU")).toBe(true);
    expect(isAllowedSchoolEmail(" ada@buc.blinn.edu ")).toBe(true);
  });

  it("rejects other domains, including lookalikes", () => {
    expect(isAllowedSchoolEmail("ada@gmail.com")).toBe(false);
    expect(isAllowedSchoolEmail("ada@blinn.edu")).toBe(false);
    expect(isAllowedSchoolEmail("ada@sub.tamu.edu")).toBe(false);
    expect(isAllowedSchoolEmail("ada@tamu.edu.evil.com")).toBe(false);
    expect(isAllowedSchoolEmail("nottamu.edu")).toBe(false);
    expect(isAllowedSchoolEmail("")).toBe(false);
    expect(isAllowedSchoolEmail(null)).toBe(false);
  });
});
