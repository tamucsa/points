import { NextResponse } from "next/server";
import {
  getPlacesApiKey,
  requireOfficerApi,
  TAMU_LOCATION_BIAS,
} from "@/utils/places";

type AutocompleteBody = {
  input?: string;
  sessionToken?: string;
};

type PlacePrediction = {
  placeId?: string;
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
  text?: { text?: string };
};

type AutocompleteResponse = {
  suggestions?: Array<{ placePrediction?: PlacePrediction }>;
};

export async function POST(request: Request) {
  const auth = await requireOfficerApi();
  if (auth.error) return auth.error;

  const key = getPlacesApiKey();
  if (!key) {
    return NextResponse.json({ suggestions: [], disabled: true });
  }

  let body: AutocompleteBody;
  try {
    body = (await request.json()) as AutocompleteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const input = body.input?.trim() ?? "";
  const sessionToken = body.sessionToken?.trim() ?? "";

  if (input.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  if (!sessionToken) {
    return NextResponse.json(
      { error: "sessionToken is required." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
        },
        body: JSON.stringify({
          input,
          sessionToken,
          locationBias: TAMU_LOCATION_BIAS,
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        "Places autocomplete failed:",
        response.status,
        detail.slice(0, 500),
      );
      return NextResponse.json({ suggestions: [] });
    }

    const data = (await response.json()) as AutocompleteResponse;
    const suggestions = (data.suggestions ?? [])
      .map((item) => {
        const prediction = item.placePrediction;
        if (!prediction?.placeId) return null;
        const primaryText =
          prediction.structuredFormat?.mainText?.text ??
          prediction.text?.text ??
          "";
        const secondaryText =
          prediction.structuredFormat?.secondaryText?.text ?? "";
        if (!primaryText) return null;
        return {
          placeId: prediction.placeId,
          primaryText,
          secondaryText,
        };
      })
      .filter(
        (
          row,
        ): row is {
          placeId: string;
          primaryText: string;
          secondaryText: string;
        } => Boolean(row),
      );

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Places autocomplete error:", err);
    return NextResponse.json({ suggestions: [] });
  }
}
