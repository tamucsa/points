import * as Sentry from "@sentry/nextjs";
import { headers } from "next/headers";

export function setSentryUser(
  member: { id: string; role?: string | null } | null,
) {
  if (!member) {
    Sentry.setUser(null);
    Sentry.setTag("member.role", "");
    return;
  }

  // Member id only — never email or name.
  Sentry.setUser({ id: member.id });
  Sentry.setTag("member.role", member.role ?? "");
}

export async function withServerAction<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  return Sentry.withServerActionInstrumentation(
    name,
    {
      headers: await headers(),
      recordResponse: false,
    },
    fn,
  );
}
