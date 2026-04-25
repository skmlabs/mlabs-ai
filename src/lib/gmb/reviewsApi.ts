import { createAdminClient } from "@/lib/supabase/admin";
import { refreshGmbToken } from "@/lib/gmb/tokens";

// Google My Business v4 API — review listing + reply lives only on v4.
// (v1 mybusinessbusinessinformation does not expose reviews.)
const GMB_API_BASE = "https://mybusiness.googleapis.com/v4";
const MAX_REVIEWS_PER_LOCATION = 500;
const PAGE_SIZE = 50;
const REQUEST_DELAY_MS = 1500;  // safe under the 100 req/min v4 quota

type StarRating = "STAR_RATING_UNSPECIFIED" | "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";

interface GmbReviewer {
  displayName?: string;
  profilePhotoUrl?: string;
  isAnonymous?: boolean;
}

interface GmbReviewReply {
  comment?: string;
  updateTime?: string;
}

interface GmbReview {
  reviewId: string;
  reviewer?: GmbReviewer;
  starRating: StarRating;
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: GmbReviewReply;
  name: string;  // full resource name: accounts/X/locations/Y/reviews/Z
}

interface ListReviewsResponse {
  reviews?: GmbReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}

const STAR_RATING_MAP: Record<StarRating, number | null> = {
  STAR_RATING_UNSPECIFIED: null,
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export type SyncStatus = "success" | "partial" | "failed";

export interface LocationSyncResult {
  fetched: number;
  status: SyncStatus;
  error?: string;
}

export async function fetchReviewsForLocation(
  locationId: string,
  userId: string,
): Promise<LocationSyncResult> {
  const admin = createAdminClient();

  const { data: location, error: locErr } = await admin
    .from("locations")
    .select("id, gmb_account_id, location_resource_name, connected_account_id, place_id, title")
    .eq("id", locationId)
    .eq("user_id", userId)
    .single();

  if (locErr || !location) {
    return { fetched: 0, status: "failed", error: "Location not found" };
  }

  // Manual entries don't have a real GMB resource — Places API only.
  if (!location.location_resource_name || location.gmb_account_id === "manual") {
    return { fetched: 0, status: "failed", error: "Manual location — no GMB resource" };
  }

  let accessToken: string;
  try {
    const t = await refreshGmbToken(location.connected_account_id);
    accessToken = t.access_token;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    await admin.from("review_sync_state").upsert({
      location_id: locationId,
      user_id: userId,
      last_sync_status: "failed",
      last_sync_error: `Token refresh failed: ${msg}`.slice(0, 500),
    });
    return { fetched: 0, status: "failed", error: `Token refresh failed: ${msg}` };
  }

  await admin.from("review_sync_state").upsert({
    location_id: locationId,
    user_id: userId,
    last_sync_status: "in_progress",
  });

  let pageToken: string | undefined;
  let totalFetched = 0;
  let pagesFetched = 0;
  const maxPages = Math.ceil(MAX_REVIEWS_PER_LOCATION / PAGE_SIZE);
  const placeIdForRow = location.place_id ?? "";  // schema NOT NULL; "" is acceptable

  try {
    do {
      const url = new URL(`${GMB_API_BASE}/${location.gmb_account_id}/${location.location_resource_name}/reviews`);
      url.searchParams.set("pageSize", String(PAGE_SIZE));
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.status === 429) {
        // Rate limited — back off once before continuing.
        await sleep(5000);
        continue;
      }
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`GMB API ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const data = await res.json() as ListReviewsResponse;
      const reviews = data.reviews ?? [];

      if (reviews.length > 0) {
        const payload = reviews.map(r => {
          const rating = STAR_RATING_MAP[r.starRating];
          const replyText = r.reviewReply?.comment?.trim() || null;
          const replyTime = r.reviewReply?.updateTime ?? null;
          return {
            user_id: userId,
            location_id: locationId,
            place_id: placeIdForRow,
            google_review_name: r.name,
            author_name: r.reviewer?.displayName ?? "Anonymous",
            author_photo_url: r.reviewer?.profilePhotoUrl ?? null,
            rating,
            text: r.comment ?? null,
            publish_time: r.createTime,
            update_time: r.updateTime,
            reply_text: replyText,
            reply_create_time: replyTime,
            reply_update_time: replyTime,
            fetched_at: new Date().toISOString(),
          };
        });
        await admin.from("cached_reviews").upsert(payload, { onConflict: "location_id,google_review_name" });
        totalFetched += payload.length;
      }

      pageToken = data.nextPageToken;
      pagesFetched++;

      if (pageToken && pagesFetched < maxPages) {
        await sleep(REQUEST_DELAY_MS);
      }

      // Refresh location_review_stats with the API's own totals if present
      if (data.averageRating != null || data.totalReviewCount != null) {
        await admin.from("location_review_stats").upsert({
          location_id: locationId,
          user_id: userId,
          average_rating: data.averageRating ?? null,
          total_reviews: data.totalReviewCount ?? totalFetched,
          last_fetched_at: new Date().toISOString(),
        }, { onConflict: "location_id" });
      }
    } while (pageToken && pagesFetched < maxPages);

    const truncated = Boolean(pageToken && pagesFetched >= maxPages);
    const finalStatus: SyncStatus = truncated ? "partial" : "success";
    await admin.from("review_sync_state").upsert({
      location_id: locationId,
      user_id: userId,
      last_synced_at: new Date().toISOString(),
      last_review_count: totalFetched,
      last_sync_status: finalStatus,
      last_sync_error: null,
    });

    return { fetched: totalFetched, status: finalStatus };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    await admin.from("review_sync_state").upsert({
      location_id: locationId,
      user_id: userId,
      last_sync_status: "failed",
      last_sync_error: errMsg.slice(0, 500),
    });
    return { fetched: totalFetched, status: "failed", error: errMsg };
  }
}

export interface BulkSyncResult {
  total_fetched: number;
  per_location: { location_id: string; fetched: number; status: SyncStatus }[];
}

export async function fetchReviewsForAllLocations(userId: string): Promise<BulkSyncResult> {
  const admin = createAdminClient();
  const { data: locations } = await admin
    .from("locations")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .neq("gmb_account_id", "manual")
    .not("location_resource_name", "is", null);

  if (!locations || locations.length === 0) return { total_fetched: 0, per_location: [] };

  const results: BulkSyncResult["per_location"] = [];
  let totalFetched = 0;

  for (const loc of locations) {
    const r = await fetchReviewsForLocation(loc.id, userId);
    results.push({ location_id: loc.id, fetched: r.fetched, status: r.status });
    totalFetched += r.fetched;
    await sleep(2000);  // gap between locations to stay well under v4 quota
  }

  return { total_fetched: totalFetched, per_location: results };
}
