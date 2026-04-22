import { createAdminClient } from "@/lib/supabase/admin";

type PlaceReview = {
  name: string;
  relativePublishTimeDescription?: string;
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  authorAttribution?: { displayName?: string; photoUri?: string };
  publishTime?: string;
};

export async function fetchReviewsFromPlaces(placeId: string): Promise<{ status: "ok"; reviews: PlaceReview[]; rating: number | null; totalReviews: number } | { status: "error"; message: string }> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return { status: "error", message: "GOOGLE_MAPS_API_KEY not set" };

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "id,rating,userRatingCount,reviews",
    },
  });
  if (!res.ok) return { status: "error", message: `${res.status}: ${(await res.text()).slice(0, 200)}` };
  const data = await res.json() as { rating?: number; userRatingCount?: number; reviews?: PlaceReview[] };
  return {
    status: "ok",
    reviews: data.reviews ?? [],
    rating: typeof data.rating === "number" ? data.rating : null,
    totalReviews: typeof data.userRatingCount === "number" ? data.userRatingCount : 0,
  };
}

export async function upsertReviews(params: { userId: string; locationId: string; placeId: string; reviews: PlaceReview[]; rating: number | null; totalReviews: number }): Promise<void> {
  const admin = createAdminClient();
  // Clear recent cache for this location then insert (simpler than diffing)
  const payload = params.reviews.map(r => ({
    user_id: params.userId,
    location_id: params.locationId,
    place_id: params.placeId,
    google_review_name: r.name,
    author_name: r.authorAttribution?.displayName ?? null,
    author_photo_url: r.authorAttribution?.photoUri ?? null,
    rating: typeof r.rating === "number" ? r.rating : null,
    text: r.text?.text ?? r.originalText?.text ?? null,
    publish_time: r.publishTime ?? null,
  }));
  if (payload.length > 0) {
    await admin.from("cached_reviews").upsert(payload, { onConflict: "location_id,google_review_name" });
  }
  await admin.from("location_review_stats").upsert({
    location_id: params.locationId,
    user_id: params.userId,
    average_rating: params.rating,
    total_reviews: params.totalReviews,
    last_fetched_at: new Date().toISOString(),
  }, { onConflict: "location_id" });
}
