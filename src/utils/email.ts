/** School domains accepted for sign-in, roster import, and guest import. */
export const ALLOWED_SCHOOL_EMAIL_DOMAINS = [
  "tamu.edu",
  "buc.blinn.edu",
] as const;

export const ALLOWED_SCHOOL_EMAIL_LABEL = "@tamu.edu or @buc.blinn.edu";

export function isAllowedSchoolEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ALLOWED_SCHOOL_EMAIL_DOMAINS.some((domain) =>
    normalized.endsWith(`@${domain}`),
  );
}
