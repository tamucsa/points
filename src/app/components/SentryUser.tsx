"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface SentryUserProps {
  id: string | null;
  role?: string | null;
}

/**
 * Attach the logged-in member to client-side Sentry events.
 * Uses member id only — never email or name.
 */
export default function SentryUser({ id, role }: SentryUserProps) {
  useEffect(() => {
    if (!id) {
      Sentry.setUser(null);
      Sentry.setTag("member.role", "");
      return;
    }

    Sentry.setUser({ id });
    Sentry.setTag("member.role", role ?? "");
  }, [id, role]);

  return null;
}
