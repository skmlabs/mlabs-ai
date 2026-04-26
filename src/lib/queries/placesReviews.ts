import { createClient } from "@/lib/supabase/server";

// Shape of a single review object inside locations.places_recent_reviews (JSONB).
// Matches the Places API (New) review payload — see src/lib/places/placesNewApi.ts.
interface RawPlaceReview {
  rating?: number;
  text?: { text?: string; languageCode?: string };
  publishTime?: string;
  relativePublishTimeDescription?: string;
  authorAttribution?: { displayName?: string; photoUri?: string };
}

export interface FlatReview {
  // Stable React key — Places API does not return a unique review id on the New
  // endpoint, so we synthesize one from place_id + publishTime.
  id: string;
  locationId: string;
  locationTitle: string;
  locationAddress: string | null;
  locationCity: string | null;
  placeId: string;
  gmbLocationResourceName: string | null;
  rating: number;
  text: string | null;
  publishTime: string;
  relativeTime: string;
  authorName: string | null;
  authorPhotoUri: string | null;
}

export interface LocationWithPlaces {
  id: string;
  title: string;
  address: string | null;
  city: string | null;
  placeId: string | null;
  gmbLocationResourceName: string | null;
  placesRating: number | null;
  placesTotalRatings: number | null;
  recentReviewsCount: number;
  recentReviews: FlatReview[];
  placesLastSyncedAt: string | null;
  placesSyncStatus: string | null;
}

/**
 * Fetches all owned active locations for a user, flattens Places-cached reviews
 * into a structured array. Used by Reviews, Reviews Inbox, My Locations, Overview.
 *
 * Note: server.ts exports `createClient` (not `createServerClient`) — verified
 * in supabase/server.ts. RLS scopes the result set to the calling user.
 */
export async function getLocationsWithPlacesForUser(
  userId: string,
): Promise<LocationWithPlaces[]> {
  const supabase = await createClient();

  const { data: locations, error } = await supabase
    .from("locations")
    .select(`
      id, title, address, city, place_id, location_resource_name,
      places_rating, places_total_ratings, places_recent_reviews,
      places_last_synced_at, places_sync_status
    `)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("title", { ascending: true });

  if (error) throw new Error(`Failed to fetch locations: ${error.message}`);
  if (!locations) return [];

  return locations.map((loc): LocationWithPlaces => {
    const rawReviews: RawPlaceReview[] = Array.isArray(loc.places_recent_reviews)
      ? (loc.places_recent_reviews as RawPlaceReview[])
      : [];

    const flattenedReviews: FlatReview[] = rawReviews.map((r, idx): FlatReview => ({
      // Tiebreak with idx in case two reviews share the same publishTime.
      id: `${loc.place_id ?? loc.id}-${r.publishTime ?? idx}`,
      locationId: loc.id,
      locationTitle: loc.title ?? "Unknown",
      locationAddress: loc.address,
      locationCity: loc.city,
      placeId: loc.place_id ?? "",
      gmbLocationResourceName: loc.location_resource_name ?? null,
      rating: typeof r.rating === "number" ? r.rating : 0,
      text: r.text?.text ?? null,
      publishTime: r.publishTime ?? "",
      relativeTime: r.relativePublishTimeDescription ?? "",
      authorName: r.authorAttribution?.displayName ?? null,
      authorPhotoUri: r.authorAttribution?.photoUri ?? null,
    }));

    return {
      id: loc.id,
      title: loc.title ?? "Unknown",
      address: loc.address,
      city: loc.city,
      placeId: loc.place_id,
      gmbLocationResourceName: loc.location_resource_name ?? null,
      placesRating: loc.places_rating !== null ? Number(loc.places_rating) : null,
      placesTotalRatings: loc.places_total_ratings,
      recentReviewsCount: flattenedReviews.length,
      recentReviews: flattenedReviews,
      placesLastSyncedAt: loc.places_last_synced_at,
      placesSyncStatus: loc.places_sync_status,
    };
  });
}

/**
 * All reviews across all owned locations, sorted newest first.
 */
export async function getAllReviewsForUser(userId: string): Promise<FlatReview[]> {
  const locations = await getLocationsWithPlacesForUser(userId);
  const all = locations.flatMap((l) => l.recentReviews);
  return all.sort((a, b) =>
    new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime(),
  );
}

/**
 * Builds the canonical "Open on Google" URL for a location.
 * Uses the documented Google Maps place URL — `business.google.com/reviews/l/{name}`
 * is undocumented and 404s in practice. Maps loads the location card; owners
 * can reply to reviews from there. Inline replies return once GMB API access
 * propagates.
 *
 * The first parameter is kept for backwards compatibility with callers; only
 * `placeId` is required for the Maps URL.
 */
export function buildReplyOnGoogleUrl(
  _gmbLocationResourceName: string | null,
  placeId: string | null,
): string | null {
  if (!placeId) return null;
  return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
}
