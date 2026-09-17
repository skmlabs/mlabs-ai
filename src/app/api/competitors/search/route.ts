import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  searchPlacesForCompetitor,
  type PlaceDetails,
  type PlaceSearchResultExtended,
} from "@/lib/places/placesNewApi";
import { categoryLabel, isValidCategory } from "@/lib/places/categories";

export const runtime = "nodejs";

type WebsiteFilter = "any" | "has" | "none";

function num(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Advanced competitor search backing /dashboard/competitors/search.
//
// Query params:
//   q          — keyword. Optional when `category` is set, otherwise >= 3 chars.
//   category   — a Places Table A type (see lib/places/categories.ts), sent as
//                `includedType` so Google filters on the place's primary type
//   city       — folded into the text query and post-filtered on the address
//   pincode    — 6-digit Indian PIN; folded into the query and post-filtered
//   minRating  — 0..5
//   minReviews / maxReviews — review-count band
//   website    — any | has | none
//   pageToken  — nextPageToken from a previous response ("Load more")
//
// Text Search (New) serves at most 20 results per page and 60 in total across
// 3 pages, and each page is a separately billed request — so pages are pulled
// only when the user asks for them.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const categoryRaw = sp.get("category")?.trim() ?? "";
  const category = categoryRaw && isValidCategory(categoryRaw) ? categoryRaw : "";
  if (categoryRaw && !category) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }

  // A category alone is a valid search; a bare keyword still needs 3 chars.
  if (!category && q.length < 3) {
    return NextResponse.json({ results: [], total: 0, filtered: 0 });
  }

  const city = sp.get("city")?.trim() ?? "";
  const pincodeRaw = sp.get("pincode")?.trim() ?? "";
  const pincode = /^\d{6}$/.test(pincodeRaw) ? pincodeRaw : "";
  if (pincodeRaw && !pincode) {
    return NextResponse.json({ error: "PIN code must be 6 digits" }, { status: 400 });
  }

  const minRating = num(sp.get("minRating"));
  const minReviews = num(sp.get("minReviews"));
  const maxReviews = num(sp.get("maxReviews"));
  const websiteRaw = sp.get("website");
  const website: WebsiteFilter =
    websiteRaw === "has" || websiteRaw === "none" ? websiteRaw : "any";
  const pageToken = sp.get("pageToken")?.trim() || undefined;

  // Location bias only helps when the user hasn't named a place themselves —
  // otherwise a Delhi-anchored account can never search Gurgaon or 560001.
  let bias: { lat: number; lng: number } | undefined;
  if (!city && !pincode) {
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

  // Build the text query from whatever the user gave us. With a category but
  // no keyword, the category label stands in as the query text.
  const queryParts = [q || categoryLabel(category) || ""];
  if (city) queryParts.push(`in ${city}`);
  if (pincode) queryParts.push(pincode);
  const textQuery = queryParts.filter(Boolean).join(" ").trim();

  try {
    const page = await searchPlacesForCompetitor(textQuery, bias, {
      // websiteUri costs a higher Places SKU, so only ask for it when the
      // user actually filters on it.
      includeWebsite: website !== "any",
      includedType: category || undefined,
      pageToken,
    });

    const cityNeedle = city.toLowerCase();
    const results = page.places.filter((p: PlaceSearchResultExtended) => {
      const address = (p.formattedAddress ?? "").toLowerCase();
      if (cityNeedle && !address.includes(cityNeedle)) return false;
      // Google treats a PIN in the query as a hint, not a constraint, so the
      // address is checked for the literal code as well.
      if (pincode && !address.includes(pincode)) return false;
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

    return NextResponse.json({
      results,
      nextPageToken: page.nextPageToken ?? null,
      total: page.places.length,
      filtered: results.length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
