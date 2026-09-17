import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  searchPlacesForCompetitor,
  type PlaceDetails,
  type PlaceSearchResultExtended,
} from "@/lib/places/placesNewApi";

export const runtime = "nodejs";

type WebsiteFilter = "any" | "has" | "none";

function num(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Advanced search for the competitor add UI.
//
// Query params:
//   q          — keyword (required, >= 3 chars)
//   city       — appended to the text query and used as a post-filter on the
//                formatted address, so "clinic" + "Gurgaon" doesn't return Delhi
//   minRating  — 0..5
//   minReviews / maxReviews — review-count band
//   website    — any | has | none
//
// Results are biased toward the user's first owned location's lat/lng, EXCEPT
// when a city is supplied — otherwise a Delhi bias fights a Mumbai search.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const query = sp.get("q")?.trim();
  if (!query || query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const city = sp.get("city")?.trim() ?? "";
  const minRating = num(sp.get("minRating"));
  const minReviews = num(sp.get("minReviews"));
  const maxReviews = num(sp.get("maxReviews"));
  const websiteRaw = sp.get("website");
  const website: WebsiteFilter =
    websiteRaw === "has" || websiteRaw === "none" ? websiteRaw : "any";

  let bias: { lat: number; lng: number } | undefined;
  if (!city) {
    const { data: ownedLoc } = await supabase
      .from("locations")
      .select("place_id")
      .eq("user_id", user.id)
      .not("place_id", "is", null)
      .limit(1)
      .maybeSingle();

    if (ownedLoc?.place_id) {
      const { data: cached } = await supabase
        .from("cached_places")
        .select("raw_response")
        .eq("place_id", ownedLoc.place_id)
        .maybeSingle();
      const raw = cached?.raw_response as Pick<PlaceDetails, "location"> | null;
      const loc = raw?.location;
      if (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
        bias = { lat: loc.latitude, lng: loc.longitude };
      }
    }
  }

  const textQuery = city ? `${query} in ${city}` : query;

  try {
    const raw = await searchPlacesForCompetitor(textQuery, bias, {
      // websiteUri costs a higher Places SKU, so only ask for it when the
      // user actually filters on it.
      includeWebsite: website !== "any",
    });

    const cityNeedle = city.toLowerCase();
    const results = raw.filter((p: PlaceSearchResultExtended) => {
      if (cityNeedle && !(p.formattedAddress ?? "").toLowerCase().includes(cityNeedle)) {
        return false;
      }
      if (minRating != null && minRating > 0) {
        if (typeof p.rating !== "number" || p.rating < minRating) return false;
      }
      const count = typeof p.userRatingCount === "number" ? p.userRatingCount : 0;
      if (minReviews != null && count < minReviews) return false;
      if (maxReviews != null && count > maxReviews) return false;
      if (website === "has" && !p.websiteUri) return false;
      if (website === "none" && p.websiteUri) return false;
      return true;
    });

    return NextResponse.json({ results, total: raw.length, filtered: results.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
