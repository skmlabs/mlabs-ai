import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getDateRange, toYMD, isValidYMD, normalizeRangeKey } from "@/lib/dateRange";
import { getLocationsWithPlacesForUser } from "@/lib/queries/placesReviews";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rangeKey = normalizeRangeKey(searchParams.get("range"));
  const locationFilter = searchParams.get("locationId");
  const customStart = searchParams.get("start");
  const customEnd = searchParams.get("end");
  const custom = rangeKey === "custom" && isValidYMD(customStart) && isValidYMD(customEnd)
    ? { start: customStart, end: customEnd }
    : undefined;
  const { start, end, label } = getDateRange(rangeKey, custom);
  const startYmd = toYMD(start), endYmd = toYMD(end);

  // Locations — excludes manual entries (gmb_account_id = "manual"); those
  // surface in Settings only, not in Overview metrics.
  let locQuery = supabase.from("locations").select("id, title, address, place_id, is_active").eq("user_id", user.id).eq("is_active", true).neq("gmb_account_id", "manual");
  if (locationFilter) locQuery = locQuery.eq("id", locationFilter);
  const { data: locations, error: locErr } = await locQuery;
  if (locErr) return NextResponse.json({ error: locErr.message }, { status: 500 });

  const locIds = (locations ?? []).map(l => l.id);
  const totalLocations = locations?.length ?? 0;

  // Daily metrics
  let metrics: Array<{ location_id: string; metric_date: string; calls: number; direction_requests: number; website_clicks: number }> = [];
  if (locIds.length > 0) {
    const { data, error } = await supabase
      .from("daily_metrics")
      .select("location_id, metric_date, calls, direction_requests, website_clicks")
      .in("location_id", locIds)
      .gte("metric_date", startYmd)
      .lte("metric_date", endYmd);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    metrics = data ?? [];
  }

  // Fetch state — is Google approval pending?
  let dataStatus: "ok" | "pending_api_access" | "never" = "never";
  if (locIds.length > 0) {
    const { data } = await supabase.from("metric_fetch_state").select("last_status").in("location_id", locIds);
    const statuses = (data ?? []).map(r => r.last_status);
    if (statuses.includes("ok")) dataStatus = "ok";
    else if (statuses.includes("pending_api_access")) dataStatus = "pending_api_access";
  }

  // Aggregates
  const totals = metrics.reduce((acc, m) => {
    acc.calls += m.calls; acc.directions += m.direction_requests; acc.website += m.website_clicks; return acc;
  }, { calls: 0, directions: 0, website: 0 });

  // By-date series
  const byDateMap = new Map<string, { date: string; calls: number; directions: number; website: number }>();
  for (const m of metrics) {
    const key = m.metric_date;
    const row = byDateMap.get(key) ?? { date: key, calls: 0, directions: 0, website: 0 };
    row.calls += m.calls; row.directions += m.direction_requests; row.website += m.website_clicks;
    byDateMap.set(key, row);
  }
  const byDate = Array.from(byDateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Top locations
  const byLoc = new Map<string, { location_id: string; title: string; calls: number; directions: number; website: number }>();
  for (const l of locations ?? []) byLoc.set(l.id, { location_id: l.id, title: l.title, calls: 0, directions: 0, website: 0 });
  for (const m of metrics) {
    const row = byLoc.get(m.location_id);
    if (row) { row.calls += m.calls; row.directions += m.direction_requests; row.website += m.website_clicks; }
  }
  const topLocations = Array.from(byLoc.values()).sort((a, b) => (b.calls + b.directions + b.website) - (a.calls + a.directions + a.website)).slice(0, 5);

  // Phase 5B Session 2: review stats + recent reviews now come from the Places
  // JSONB cache (interim path while GMB API approval propagates). The response
  // shape is preserved so the dashboard page doesn't need changes.
  let avgRating: number | null = null, totalReviews = 0;
  let recentReviews: Array<{ author: string | null; rating: number | null; text: string | null; publish_time: string | null; location_title: string | null }> = [];
  if (locIds.length > 0) {
    const placesLocations = await getLocationsWithPlacesForUser(user.id);
    const scoped = locationFilter
      ? placesLocations.filter(l => l.id === locationFilter)
      : placesLocations;

    // Weighted avg rating: sum(rating * total_ratings) / sum(total_ratings).
    let weightedSum = 0, weightTotal = 0;
    for (const l of scoped) {
      const total = l.placesTotalRatings ?? 0;
      totalReviews += total;
      if (l.placesRating != null && total > 0) {
        weightedSum += l.placesRating * total;
        weightTotal += total;
      }
    }
    avgRating = weightTotal > 0 ? Number((weightedSum / weightTotal).toFixed(2)) : null;

    recentReviews = scoped
      .flatMap(l => l.recentReviews.map(r => ({
        author: r.authorName,
        rating: r.rating,
        text: r.text,
        publish_time: r.publishTime,
        location_title: l.title,
      })))
      .sort((a, b) => new Date(b.publish_time ?? 0).getTime() - new Date(a.publish_time ?? 0).getTime())
      .slice(0, 5);
  }

  return NextResponse.json({
    range: { key: rangeKey, label, start: startYmd, end: endYmd },
    locationFilter: locationFilter ?? null,
    totals: { ...totals, totalLocations },
    byDate,
    topLocations,
    dataStatus,
    reviews: { avgRating, totalReviews, recent: recentReviews },
  });
}
