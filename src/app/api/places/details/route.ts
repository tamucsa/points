import { NextResponse } from "next/server";
import {
  formatPlaceLocation,
  getPlacesApiKey,
  requireOfficerApi,
} from "@/utils/places";

type DetailsBody = {
  placeId?: string;
  sessionToken?: string;
};

type PlaceDetailsResponse = {
  displayName?: { text?: string };
  formattedAddress?: string;
  googleMapsUri?: string;
};

export async function POST(request: Request) {
  const auth = await requireOfficerApi();
  if (auth.error) return auth.error;

  const key = getPlacesApiKey();
  if (!key) {
    return NextResponse.json(
      { error: "Places is not configured." },
      { status: 503 },
    );
  }

  let body: DetailsBody;
  try {
    body = (await request.json()) as DetailsBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const placeId = body.placeId?.trim() ?? "";
  const sessionToken = body.sessionToken?.trim() ?? "";

  if (!placeId) {
    return NextResponse.json(
      { error: "placeId is required." },
      { status: 400 },
    );
  }
  if (!sessionToken) {
    return NextResponse.json(
      { error: "sessionToken is required." },
      { status: 400 },
    );
  }

  // Place resource names may be "places/ChIJ..." or raw place IDs.
  const resourceId = placeId.startsWith("places/")
    ? placeId.slice("places/".length)
    : placeId;

  try {
    const url = new URL(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(resourceId)}`,
    );
    url.searchParams.set("sessionToken", sessionToken);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "displayName,formattedAddress,googleMapsUri",
      },
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        "Places details failed:",
        response.status,
        detail.slice(0, 500),
      );
      return NextResponse.json(
        { error: "Failed to load place details." },
        { status: 502 },
      );
    }

    const data = (await response.json()) as PlaceDetailsResponse;
    const location = formatPlaceLocation(
      data.displayName?.text,
      data.formattedAddress,
    );

    if (!location) {
      return NextResponse.json(
        { error: "Place had no name." },
        { status: 502 },
      );
    }

    const mapsUrl =
      data.googleMapsUri?.trim() ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}&query_place_id=${encodeURIComponent(resourceId)}`;

    return NextResponse.json({ location, mapsUrl });
  } catch (err) {
    console.error("Places details error:", err);
    return NextResponse.json(
      { error: "Failed to load place details." },
      { status: 502 },
    );
  }
}
