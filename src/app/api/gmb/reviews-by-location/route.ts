import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getLocationsWithPlacesForUser, type FlatReview } from "@/lib/queries/placesReviews";

export const runtime = "nodejs";

// Phase 5B Session 2: data source switched from cached_reviews (GMB v4) to the
// Places API JSONB cache, since GMB API approval has not yet propagated. Shape
// of the response is preserved so the page can keep its grouping UI; the
// `reply_*` fields are simply omitted.
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const locationFilter = searchParams.get("locationId");
  const minRating = searchParams.get("minRating");
  const maxRating = searchParams.get("maxRating");

  const min = minRating ? parseInt(minRating, 10) : null;
  const max = maxRating ? parseInt(maxRating, 10) : null;

  const locations = await getLocationsWithPlacesForUser(user.id);
  const filtered = locationFilter ? locations.filter(l => l.id === locationFilter) : locations;

  const groups = filtered.map(loc => {
    const visibleReviews = loc.recentReviews.filter(r => {
      if (min != null && r.rating < min) return false;
      if (max != null && r.rating > max) return false;
      return true;
    });

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
    for (const r of visibleReviews) {
      const rating = r.rating;
      if (rating >= 1 && rating <= 5) {
        distribution[rating as 1 | 2 | 3 | 4 | 5]++;
      }
    }

    return {
      location_id: loc.id,
      title: loc.title,
      address: loc.address,
      city: loc.city,
      avg_rating: loc.placesRating,
      total_reviews: loc.placesTotalRatings ?? 0,
      shown_reviews: visibleReviews.length,
      distribution,
      reviews: visibleReviews.map(toLegacyShape),
    };
  });

  return NextResponse.json({ groups });
}

function toLegacyShape(r: FlatReview) {
  return {
    id: r.id,
    author_name: r.authorName,
    author_photo_url: r.authorPhotoUri,
    rating: r.rating,
    text: r.text,
    publish_time: r.publishTime,
    relative_time: r.relativeTime,
  };
}
