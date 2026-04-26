import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildReplyOnGoogleUrl,
  getAllReviewsForUser,
  getLocationsWithPlacesForUser,
} from "@/lib/queries/placesReviews";

export const runtime = "nodejs";

// Phase 5B Session 2: switched data source from cached_reviews (GMB v4) to the
// Places JSONB cache. Status filter and TAT/response metrics are no longer
// computed because Places API doesn't expose reply data — KPI cards are
// hidden in the UI; we still return a zero-shaped `metrics` block for compat.
//
// GET /api/reviews/inbox
//   ?rating=1,2,3,4,5     (subset; default = all)
//   &location_id=<uuid>   (single location filter; default = all)
//   &sort=newest|oldest|lowest_rating
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const ratingsRaw = sp.get("rating");
  const ratings = ratingsRaw
    ? ratingsRaw.split(",").map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 5)
    : [];
  const sortKey = sp.get("sort") ?? "newest";
  const locationFilter = sp.get("location_id");

  const [allReviews, locations] = await Promise.all([
    getAllReviewsForUser(user.id),
    getLocationsWithPlacesForUser(user.id),
  ]);

  let reviews = allReviews;
  if (locationFilter) reviews = reviews.filter(r => r.locationId === locationFilter);
  if (ratings.length > 0) reviews = reviews.filter(r => ratings.includes(r.rating));

  if (sortKey === "oldest") {
    reviews = [...reviews].sort((a, b) =>
      new Date(a.publishTime).getTime() - new Date(b.publishTime).getTime(),
    );
  } else if (sortKey === "lowest_rating") {
    reviews = [...reviews].sort((a, b) => {
      if (a.rating !== b.rating) return a.rating - b.rating;
      return new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime();
    });
  }
  // "newest" is the default — getAllReviewsForUser already returns reviews in
  // publishTime-desc order, so no additional sort is needed.

  const enrichedReviews = reviews.map(r => ({
    id: r.id,
    location_id: r.locationId,
    location_title: r.locationTitle,
    author_name: r.authorName,
    author_photo_url: r.authorPhotoUri,
    rating: r.rating,
    text: r.text,
    publish_time: r.publishTime,
    relative_time: r.relativeTime,
    reply_on_google_url: buildReplyOnGoogleUrl(r.gmbLocationResourceName, r.placeId),
  }));

  return NextResponse.json({
    reviews: enrichedReviews,
    metrics: {
      total_in_range: enrichedReviews.length,
      responded_in_range: 0,
      unresponded_in_range: 0,
      responded_pct: 0,
      avg_tat_seconds: null,
      median_tat_seconds: null,
    },
    locations: locations.map(l => ({ id: l.id, title: l.title })),
  });
}
