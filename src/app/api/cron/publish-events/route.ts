import { NextResponse } from "next/server";
import { publishDueScheduledEvents } from "@/app/actions/events";

/**
 * Vercel Cron (or manual) endpoint to publish scheduled events past publish_at.
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 503 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await publishDueScheduledEvents();
  if (!result.success) {
    return NextResponse.json(
      { error: result.error, published: result.published },
      { status: 500 },
    );
  }

  return NextResponse.json({ published: result.published });
}
