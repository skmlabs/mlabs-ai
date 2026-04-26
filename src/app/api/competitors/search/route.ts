import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchPlacesForCompetitor, type PlaceDetails } from "@/lib/places/placesNewApi";

export const runtime = "nodejs";

// Autocomplete for the competitor add UI. Biases the search toward the user's
// first owned location's lat/lng so results are nearby, since competitor
// tracking is almost always city-local.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = req.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const { data: ownedLoc } = await supabase
    .from("locations")
    .select("place_id")
    .eq("user_id", user.id)
    .not("place_id", "is", null)
    .limit(1)
    .maybeSingle();

  let bias: { lat: number; lng: number } | undefined;
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

  try {
    const results = await searchPlacesForCompetitor(query, bias);
    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
