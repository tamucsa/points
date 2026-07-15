import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** Texas A&M / College Station — bias Places results toward campus. */
export const TAMU_LOCATION_BIAS = {
  circle: {
    center: {
      latitude: 30.6187,
      longitude: -96.3365,
    },
    /** ~8km covers main campus + nearby Bryan/College Station venues */
    radius: 8000.0,
  },
} as const;

export function getPlacesApiKey(): string | null {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  return key || null;
}

export async function requireOfficerApi() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      ),
    };
  }

  const { data: member } = await supabase
    .from("members")
    .select("id, role")
    .eq("auth_uid", user.id)
    .maybeSingle();

  if (!member || !["officer", "admin"].includes(member.role)) {
    return {
      error: NextResponse.json(
        { error: "Officer access required." },
        { status: 403 },
      ),
    };
  }

  return { error: null as null, member, supabase };
}

export function formatPlaceLocation(
  displayName: string | null | undefined,
  formattedAddress: string | null | undefined,
): string {
  const name = displayName?.trim() ?? "";
  const address = formattedAddress?.trim() ?? "";
  if (name && address) {
    if (address.toLowerCase().startsWith(name.toLowerCase())) return address;
    return `${name}, ${address}`;
  }
  return name || address;
}
