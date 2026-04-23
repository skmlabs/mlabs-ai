import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getDateRange, toYMD, isValidYMD, type DateRangeKey } from "@/lib/dateRange";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rangeKey = (searchParams.get("range") ?? "28d") as DateRangeKey;
  const locationFilter = searchParams.get("locationId");
  const customStart = searchParams.get("start");
  const customEnd = searchParams.get("end");
  const custom = rangeKey === "custom" && isValidYMD(customStart) && isValidYMD(customEnd)
    ? { start: customStart, end: customEnd }
    : undefined;
  const { start, end, label } = getDateRange(rangeKey, custom);
  const startYmd = toYMD(start), endYmd = toYMD(end);

  // Locations
  let locQuery = supabase.from("locations").select("id, title, address, place_id, is_active").eq("user_id", user.id).eq("is_active", true);
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

  // Review stats + recent reviews across locations
  let avgRating: number | null = null, totalReviews = 0;
  let recentReviews: Array<{ author: string | null; rating: number | null; text: string | null; publish_time: string | null; location_title: string | null }> = [];
  if (locIds.length > 0) {
    const { data: stats } = await supabase.from("location_review_stats").select("average_rating, total_reviews").in("location_id", locIds);
    if (stats && stats.length > 0) {
      let sum = 0, n = 0;
      for (const s of stats) {
        if (typeof s.average_rating === "number") { sum += s.average_rating * (s.total_reviews ?? 0); n += s.total_reviews ?? 0; }
        totalReviews += s.total_reviews ?? 0;
      }
      avgRating = n > 0 ? Number((sum / n).toFixed(2)) : null;
    }
    const { data: rr } = await supabase
      .from("cached_reviews")
      .select("author_name, rating, text, publish_time, location_id")
      .in("location_id", locIds)
      .order("publish_time", { ascending: false, nullsFirst: false })
      .limit(5);
    const locTitleMap = new Map((locations ?? []).map(l => [l.id, l.title]));
    recentReviews = (rr ?? []).map(r => ({ author: r.author_name, rating: r.rating, text: r.text, publish_time: r.publish_time, location_title: locTitleMap.get(r.location_id) ?? null }));
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
