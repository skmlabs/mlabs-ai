import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlaceDetails } from "@/lib/places/placesNewApi";
import { extractCity } from "@/lib/places/cityExtractor";
import {
  estimateForCompetitor,
  type CompetitorEstimates,
  type OwnedLocationStats,
} from "@/lib/competitors/estimates";

export const runtime = "nodejs";

interface ReviewWithTime { publishTime?: string }
interface OwnedCategoriesShape { primaryCategory?: { displayName?: string } }

// GET — list competitors enriched with Formula B estimates. Computing estimates
// server-side avoids a second round trip from the page.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: competitors, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!competitors || competitors.length === 0) {
    return NextResponse.json({ competitors: [] });
  }

  // Build owned-location stats for the estimator.
  const { data: ownedLocs } = await supabase
    .from("locations")
    .select("id, city, categories, places_recent_reviews, places_total_ratings")
    .eq("user_id", user.id)
    .eq("is_active", true);

  const owned = ownedLocs ?? [];
  const ownedIds = owned.map(l => l.id);

  // Pull last 30 days of metrics per location, sum into a map.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const metricsByLocation = new Map<string, { calls: number; directions: number; website: number }>();
  if (ownedIds.length > 0) {
    const { data: metrics } = await supabase
      .from("daily_metrics")
      .select("location_id, calls, direction_requests, website_clicks")
      .in("location_id", ownedIds)
      .gte("metric_date", thirtyDaysAgo);
    for (const m of metrics ?? []) {
      const r = metricsByLocation.get(m.location_id) ?? { calls: 0, directions: 0, website: 0 };
      r.calls += m.calls; r.directions += m.direction_requests; r.website += m.website_clicks;
      metricsByLocation.set(m.location_id, r);
    }
  }

  const ownedStats: OwnedLocationStats[] = owned.map(l => {
    const cats = l.categories as OwnedCategoriesShape | null;
    const reviewsRaw = Array.isArray(l.places_recent_reviews)
      ? (l.places_recent_reviews as ReviewWithTime[])
      : [];
    const reviews = reviewsRaw
      .filter((r): r is { publishTime: string } => typeof r.publishTime === "string");
    const m = metricsByLocation.get(l.id) ?? { calls: 0, directions: 0, website: 0 };
    return {
      locationId: l.id,
      city: l.city ?? null,
      category: cats?.primaryCategory?.displayName ?? null,
      recentReviews: reviews,
      totalRatings: l.places_total_ratings ?? null,
      calls30d: m.calls,
      directions30d: m.directions,
      website30d: m.website,
    };
  });

  const enriched = competitors.map(c => {
    const reviewsRaw = Array.isArray(c.recent_reviews)
      ? (c.recent_reviews as ReviewWithTime[])
      : [];
    const reviews = reviewsRaw
      .filter((r): r is { publishTime: string } => typeof r.publishTime === "string");
    const estimates: CompetitorEstimates = estimateForCompetitor(
      {
        competitorId: c.id,
        city: c.city ?? null,
        category: c.category ?? null,
        recentReviews: reviews,
        totalRatings: c.total_ratings ?? null,
      },
      ownedStats,
    );
    return { ...c, estimates };
  });

  return NextResponse.json({ competitors: enriched });
}

// POST — add a competitor. Gated on the user having at least one owned
// location with a place_id (estimates are useless otherwise, and the gate
// nudges the user through the right onboarding flow).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await supabase
    .from("locations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("place_id", "is", null);

  if (!count || count === 0) {
    return NextResponse.json(
      { error: "Add at least one owned location before tracking competitors." },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const placeId = typeof (body as { placeId?: unknown }).placeId === "string"
    ? (body as { placeId: string }).placeId
    : null;
  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("competitors")
    .select("id")
    .eq("user_id", user.id)
    .eq("place_id", placeId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Competitor already tracked" }, { status: 409 });
  }

  try {
    const details = await getPlaceDetails(placeId);
    // getPlaceDetails already sorts reviews newest-first as of Session 1 fix.
    const reviews = Array.isArray(details.reviews) ? details.reviews : [];

    const { data: inserted, error: insertErr } = await supabase
      .from("competitors")
      .insert({
        user_id: user.id,
        place_id: placeId,
        name: details.displayName?.text ?? "Unknown",
        formatted_address: details.formattedAddress ?? null,
        city: extractCity(details.addressComponents),
        lat: details.location?.latitude ?? null,
        lng: details.location?.longitude ?? null,
        category: details.primaryTypeDisplayName?.text
          ?? details.primaryType
          ?? null,
        google_maps_uri: details.googleMapsUri ?? null,
        rating: details.rating ?? null,
        total_ratings: details.userRatingCount ?? null,
        recent_reviews: reviews,
        last_synced_at: new Date().toISOString(),
        sync_status: "success",
      })
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);

    await supabase.from("cached_places").upsert(
      { place_id: placeId, raw_response: details, fetched_at: new Date().toISOString() },
      { onConflict: "place_id" },
    );

    return NextResponse.json({ competitor: inserted });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Add competitor failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE — remove a tracked competitor by id.
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("competitors")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
