import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDateRange, isValidYMD, normalizeRangeKey, parseYMDToUTC } from "@/lib/dateRange";

export const runtime = "nodejs";

// GET /api/reviews/inbox
//   ?range=28d (DateRangeKey) | range=custom & start=YYYY-MM-DD & end=YYYY-MM-DD
//   &rating=1,2,3,4,5     (subset; default = all)
//   &status=all|responded|unresponded
//   &location_id=<uuid>   (single location filter; default = all non-manual)
//   &sort=newest|oldest|lowest_rating
//
// Returns { reviews, metrics, locations } so the inbox can render filters,
// list, detail, and the reputation card row from one round trip.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const rangeKey = normalizeRangeKey(sp.get("range"));
  const customStart = sp.get("start");
  const customEnd = sp.get("end");
  const custom = rangeKey === "custom" && isValidYMD(customStart) && isValidYMD(customEnd)
    ? { start: customStart, end: customEnd } : undefined;
  const { start, end, label } = getDateRange(rangeKey, custom);

  // The date-range util gives us "yesterday" as end (GMB metric lag); for
  // reviews we want end-of-day INCLUSIVE so today's replies show up.
  const fromIso = start.toISOString();
  const toBoundary = new Date(end);
  toBoundary.setUTCHours(23, 59, 59, 999);
  // For 7d/28d ranges, also push end to "now" so brand-new reviews appear today.
  const nowMs = Date.now();
  if (toBoundary.getTime() < nowMs) toBoundary.setTime(nowMs);
  const toIso = toBoundary.toISOString();

  const ratingsRaw = sp.get("rating");
  const ratings = ratingsRaw
    ? ratingsRaw.split(",").map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 5)
    : [];
  const statusFilter = sp.get("status") ?? "all";
  const sortKey = sp.get("sort") ?? "newest";
  const locationFilter = sp.get("location_id");

  // Locations: all GMB-synced (non-manual) locations the user owns.
  let locQuery = supabase
    .from("locations")
    .select("id, title, address, gmb_account_id, location_resource_name")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .neq("gmb_account_id", "manual");
  if (locationFilter) locQuery = locQuery.eq("id", locationFilter);
  const { data: locations, error: locErr } = await locQuery;
  if (locErr) return NextResponse.json({ error: locErr.message }, { status: 500 });

  // Locations dropdown (always all of them, regardless of single-location filter)
  const { data: allLocations } = await supabase
    .from("locations")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .neq("gmb_account_id", "manual")
    .order("title", { ascending: true });

  const locs = locations ?? [];
  if (locs.length === 0) {
    return NextResponse.json({
      range: { key: rangeKey, label, start: customStart ?? start.toISOString().slice(0, 10), end: customEnd ?? end.toISOString().slice(0, 10) },
      reviews: [],
      metrics: emptyMetrics(),
      locations: allLocations ?? [],
    });
  }
  const locIds = locs.map(l => l.id);

  let reviewQuery = supabase
    .from("cached_reviews")
    .select(
      "id, location_id, google_review_name, author_name, author_photo_url, rating, text, publish_time, update_time, reply_text, reply_create_time, reply_update_time, replied_by_user_id, replied_by_name, has_reply, first_response_tat_seconds"
    )
    .in("location_id", locIds)
    .gte("publish_time", fromIso)
    .lte("publish_time", toIso);

  if (ratings.length > 0) reviewQuery = reviewQuery.in("rating", ratings);
  if (statusFilter === "responded") reviewQuery = reviewQuery.eq("has_reply", true);
  else if (statusFilter === "unresponded") reviewQuery = reviewQuery.eq("has_reply", false);

  if (sortKey === "oldest") {
    reviewQuery = reviewQuery.order("publish_time", { ascending: true, nullsFirst: false });
  } else if (sortKey === "lowest_rating") {
    reviewQuery = reviewQuery.order("rating", { ascending: true, nullsFirst: false }).order("publish_time", { ascending: false });
  } else {
    reviewQuery = reviewQuery.order("publish_time", { ascending: false, nullsFirst: false });
  }

  const { data: reviews, error: revErr } = await reviewQuery.limit(500);
  if (revErr) return NextResponse.json({ error: revErr.message }, { status: 500 });

  const titleMap = new Map(locs.map(l => [l.id, l.title]));
  const enrichedReviews = (reviews ?? []).map(r => ({
    ...r,
    location_title: titleMap.get(r.location_id) ?? null,
  }));

  // Metrics computed off the FILTERED set so the cards reflect what the user sees.
  const metrics = computeMetrics(enrichedReviews);

  return NextResponse.json({
    range: {
      key: rangeKey,
      label,
      start: parseYMDIfPresent(customStart) ?? toYmdUtc(start),
      end: parseYMDIfPresent(customEnd) ?? toYmdUtc(end),
    },
    reviews: enrichedReviews,
    metrics,
    locations: allLocations ?? [],
  });
}

function toYmdUtc(d: Date): string { return d.toISOString().slice(0, 10); }
function parseYMDIfPresent(s: string | null): string | null {
  if (!s || !isValidYMD(s)) return null;
  return toYmdUtc(parseYMDToUTC(s));
}

interface InboxReview {
  has_reply: boolean | null;
  first_response_tat_seconds: number | null;
}

function emptyMetrics() {
  return {
    total_in_range: 0,
    responded_in_range: 0,
    unresponded_in_range: 0,
    responded_pct: 0,
    avg_tat_seconds: null as number | null,
    median_tat_seconds: null as number | null,
  };
}

function computeMetrics(reviews: InboxReview[]) {
  const total = reviews.length;
  const responded = reviews.filter(r => r.has_reply === true).length;
  const unresponded = total - responded;
  const respondedPct = total > 0 ? Math.round((responded / total) * 1000) / 10 : 0;
  const tats = reviews
    .map(r => r.first_response_tat_seconds)
    .filter((v): v is number => typeof v === "number" && v >= 0);
  const avg = tats.length > 0 ? tats.reduce((a, b) => a + b, 0) / tats.length : null;
  const median = tats.length > 0 ? medianOf(tats) : null;
  return {
    total_in_range: total,
    responded_in_range: responded,
    unresponded_in_range: unresponded,
    responded_pct: respondedPct,
    avg_tat_seconds: avg,
    median_tat_seconds: median,
  };
}

function medianOf(nums: number[]): number {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const a = sorted[mid - 1] ?? 0;
    const b = sorted[mid] ?? 0;
    return (a + b) / 2;
  }
  return sorted[mid] ?? 0;
}
