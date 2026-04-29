import { createAdminClient } from "@/lib/supabase/admin";
import { getPlaceDetails } from "./placesNewApi";
import { extractCity } from "./cityExtractor";
import { findPlaceIdForLocation } from "./reverseLookup";
import { setSyncProgress } from "@/lib/sync/progress";

interface SyncResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{ locationId: string; error: string }>;
}

type AdminClient = ReturnType<typeof createAdminClient>;

interface LocationRow {
  id: string;
  title: string;
  address: string | null;
  place_id: string | null;
}

// Per-location sync extracted so the outer loop can be parallelized cleanly.
// Throws on failure — the caller writes the failed status to the locations row.
async function syncOneLocation(admin: AdminClient, loc: LocationRow): Promise<void> {
  let placeId = loc.place_id;

  if (!placeId) {
    const found = await findPlaceIdForLocation(loc.title, loc.address ?? "");
    if (!found) throw new Error("Reverse lookup returned no match");
    placeId = found;
  }

  const details = await getPlaceDetails(placeId);
  const city = extractCity(details.addressComponents);

  const { error: updateErr } = await admin
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
  await admin.from("cached_places").upsert(
    {
      place_id: placeId,
      raw_response: details,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "place_id" },
  );
}

// Process locations in parallel chunks. 5 in flight at a time stays well under
// the Places API default 600 QPM. Sequential chunks (not full parallel) gives
// us a predictable ceiling for very large location counts.
const CHUNK_SIZE = 5;

// Schema note: the actual column is `title` (not `name`/`location_name`) — verified
// in supabase/migrations/0001_init.sql. Service-role client is `createAdminClient`
// (not `createServiceRoleClient`).
export async function syncOwnedLocationsForUser(userId: string): Promise<SyncResult> {
  const admin = createAdminClient();
  const result: SyncResult = { total: 0, succeeded: 0, failed: 0, errors: [] };

  const { data: locations, error } = await admin
    .from("locations")
    .select("id, title, address, place_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw new Error(`Failed to fetch locations: ${error.message}`);

  // Initialize visible progress even when there's nothing to sync, so the
  // UI's poller resolves to a finished state instead of hanging.
  const total = locations?.length ?? 0;
  const startedAt = Date.now();
  await setSyncProgress(userId, { total, completed: 0, status: total === 0 ? "complete" : "running", startedAt, completedAt: total === 0 ? Date.now() : undefined });

  if (!locations || locations.length === 0) return result;

  result.total = locations.length;

  for (let i = 0; i < locations.length; i += CHUNK_SIZE) {
    const chunk = locations.slice(i, i + CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map(async loc => {
        try {
          await syncOneLocation(admin, loc);
          return { ok: true as const, locationId: loc.id };
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : String(e);
          // Mark failure on the row in the same parallel pass so a slow batch
          // doesn't leave stale "in_progress"-looking rows.
          await admin
            .from("locations")
            .update({
              places_last_synced_at: new Date().toISOString(),
              places_sync_status: "failed",
              places_sync_error: errMsg.slice(0, 500),
            })
            .eq("id", loc.id);
          return { ok: false as const, locationId: loc.id, error: errMsg };
        }
      }),
    );

    for (const r of chunkResults) {
      if (r.ok) result.succeeded += 1;
      else {
        result.failed += 1;
        result.errors.push({ locationId: r.locationId, error: r.error });
      }
    }

    // Visible progress after each chunk. completed counts every location the
    // sync has finished trying — succeeded + failed — so the bar still moves
    // when individual locations error out.
    await setSyncProgress(userId, {
      total,
      completed: result.succeeded + result.failed,
      status: "running",
      startedAt,
    });
  }

  await setSyncProgress(userId, {
    total,
    completed: total,
    status: "complete",
    startedAt,
    completedAt: Date.now(),
  });

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
