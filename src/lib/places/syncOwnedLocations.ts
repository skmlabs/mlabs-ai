import { createAdminClient } from "@/lib/supabase/admin";
import { getPlaceDetails } from "./placesNewApi";
import { extractCity } from "./cityExtractor";
import { findPlaceIdForLocation } from "./reverseLookup";

interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ locationId: string; error: string }>;
}

// Schema note: the actual column is `title` (not `name`/`location_name`) — verified
// in supabase/migrations/0001_init.sql. Service-role client is `createAdminClient`
// (not `createServiceRoleClient`).
export async function syncOwnedLocationsForUser(userId: string): Promise<SyncResult> {
  const supabase = createAdminClient();
  const result: SyncResult = { total: 0, succeeded: 0, failed: 0, errors: [] };

  const { data: locations, error } = await supabase
    .from("locations")
    .select("id, title, address, place_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw new Error(`Failed to fetch locations: ${error.message}`);
  if (!locations || locations.length === 0) return result;

  result.total = locations.length;

  for (const loc of locations) {
    try {
      let placeId = loc.place_id;

      if (!placeId) {
        const found = await findPlaceIdForLocation(loc.title, loc.address ?? "");
        if (!found) {
          throw new Error("Reverse lookup returned no match");
        }
        placeId = found;
      }

      const details = await getPlaceDetails(placeId);
      const city = extractCity(details.addressComponents);

      const { error: updateErr } = await supabase
        .from("locations")
        .update({
          place_id: placeId,
          city,
          places_rating: details.rating ?? null,
          places_total_ratings: details.userRatingCount ?? null,
          places_recent_reviews: details.reviews ?? [],
          places_last_synced_at: new Date().toISOString(),
          places_sync_status: "success",
          places_sync_error: null,
        })
        .eq("id", loc.id);

      if (updateErr) throw new Error(updateErr.message);

      // Cache the raw response for cross-user dedup (used in Session 3 for competitors).
      await supabase.from("cached_places").upsert(
        {
          place_id: placeId,
          raw_response: details,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "place_id" },
      );

      result.succeeded += 1;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      result.failed += 1;
      result.errors.push({ locationId: loc.id, error: errMsg });
      await supabase
        .from("locations")
        .update({
          places_last_synced_at: new Date().toISOString(),
          places_sync_status: "failed",
          places_sync_error: errMsg.slice(0, 500),
        })
        .eq("id", loc.id);
    }
  }

  return result;
}

export async function syncAllOwnedLocations(): Promise<SyncResult> {
  const supabase = createAdminClient();
  const result: SyncResult = { total: 0, succeeded: 0, failed: 0, errors: [] };

  const { data: users } = await supabase.from("users").select("id");
  if (!users) return result;

  for (const u of users) {
    const userResult = await syncOwnedLocationsForUser(u.id);
    result.total += userResult.total;
    result.succeeded += userResult.succeeded;
    result.failed += userResult.failed;
    result.errors.push(...userResult.errors);
  }

  return result;
}
