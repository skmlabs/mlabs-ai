import { createAdminClient } from "@/lib/supabase/admin";
import { getPlaceDetails, type PlaceDetails } from "./placesNewApi";
import { extractCity } from "./cityExtractor";

interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ competitorId: string; error: string }>;
}

interface ReviewWithTime {
  publishTime: string;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Schema note: service-role client is `createAdminClient` from supabase/admin.
//
// Refreshes data for all competitors of a user. Uses cached_places when fresh
// (< 7 days old) to dedupe Places API hits across users tracking the same
// competitor — important since competitor lists between users overlap heavily
// in single-city verticals.
export async function syncCompetitorsForUser(userId: string): Promise<SyncResult> {
  const supabase = createAdminClient();
  const result: SyncResult = { total: 0, succeeded: 0, failed: 0, errors: [] };

  const { data: competitors, error } = await supabase
    .from("competitors")
    .select("id, place_id, name")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to fetch competitors: ${error.message}`);
  if (!competitors || competitors.length === 0) return result;

  result.total = competitors.length;
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  for (const comp of competitors) {
    try {
      const { data: cached } = await supabase
        .from("cached_places")
        .select("raw_response, fetched_at")
        .eq("place_id", comp.place_id)
        .gte("fetched_at", sevenDaysAgo)
        .maybeSingle();

      const details: PlaceDetails = cached?.raw_response
        ? (cached.raw_response as PlaceDetails)
        : await getPlaceDetails(comp.place_id);

      const city = extractCity(details.addressComponents);

      // Sort newest-first as a safety net — fresh getPlaceDetails already sorts,
      // but cached responses written before that fix may not be sorted.
      const reviews: ReviewWithTime[] = Array.isArray(details.reviews) ? details.reviews : [];
      reviews.sort((a, b) =>
        new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime(),
      );

      const updateData = {
        name: details.displayName?.text ?? comp.name,
        formatted_address: details.formattedAddress ?? null,
        city,
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
        sync_error: null,
      };

      const { error: updateErr } = await supabase
        .from("competitors")
        .update(updateData)
        .eq("id", comp.id);

      if (updateErr) throw new Error(updateErr.message);

      // Cache write only when we hit the API live (no point rewriting a cache
      // entry we just read from).
      if (!cached) {
        await supabase.from("cached_places").upsert(
          { place_id: comp.place_id, raw_response: details, fetched_at: new Date().toISOString() },
          { onConflict: "place_id" },
        );
      }

      result.succeeded += 1;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      result.failed += 1;
      result.errors.push({ competitorId: comp.id, error: errMsg });
      await supabase
        .from("competitors")
        .update({
          last_synced_at: new Date().toISOString(),
          sync_status: "failed",
          sync_error: errMsg.slice(0, 500),
        })
        .eq("id", comp.id);
    }
  }

  return result;
}

// Note: PlaceDetails interface in placesNewApi.ts doesn't currently include
// primaryTypeDisplayName since the original details mask omits it. The sync
// path reads it via the typed PlaceDetails — extend the type if you need
// strict typing for that field.

export async function syncAllCompetitors(): Promise<SyncResult> {
  const supabase = createAdminClient();
  const result: SyncResult = { total: 0, succeeded: 0, failed: 0, errors: [] };

  const { data: rows } = await supabase
    .from("competitors")
    .select("user_id")
    .order("user_id");

  if (!rows) return result;

  const uniqueUserIds = Array.from(new Set(rows.map(r => r.user_id)));
  for (const userId of uniqueUserIds) {
    const userResult = await syncCompetitorsForUser(userId);
    result.total += userResult.total;
    result.succeeded += userResult.succeeded;
    result.failed += userResult.failed;
    result.errors.push(...userResult.errors);
  }

  return result;
}
