import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getDateRange, toYMD, isValidYMD, normalizeRangeKey } from "@/lib/dateRange";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rangeKey = normalizeRangeKey(searchParams.get("range"));
  const customStart = searchParams.get("start");
  const customEnd = searchParams.get("end");
  const custom = rangeKey === "custom" && isValidYMD(customStart) && isValidYMD(customEnd)
    ? { start: customStart, end: customEnd }
    : undefined;
  const { start, end, label } = getDateRange(rangeKey, custom);
  const startYmd = toYMD(start), endYmd = toYMD(end);

  // Filter out manual entries — My Locations shows only GMB-synced locations.
  // Manual entries are flagged with gmb_account_id = "manual" (see /api/gmb/locations/manual).
  const { data: locations, error: locErr } = await supabase
    .from("locations")
    .select("id, title, address, place_id, is_active, primary_phone, website_uri")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .neq("gmb_account_id", "manual");
  if (locErr) return NextResponse.json({ error: locErr.message }, { status: 500 });
  const locs = locations ?? [];
  if (locs.length === 0) return NextResponse.json({ rows: [], range: { key: rangeKey, label, start: startYmd, end: endYmd } });

  const locIds = locs.map(l => l.id);

  const { data: metrics } = await supabase
    .from("daily_metrics")
    .select("location_id, calls, direction_requests, website_clicks")
    .in("location_id", locIds)
    .gte("metric_date", startYmd)
    .lte("metric_date", endYmd);

  const { data: reviewStats } = await supabase
    .from("location_review_stats")
    .select("location_id, average_rating, total_reviews, last_fetched_at")
    .in("location_id", locIds);

  const { data: fetchState } = await supabase
    .from("metric_fetch_state")
    .select("location_id, last_status")
    .in("location_id", locIds);

  const metricsMap = new Map<string, { calls: number; directions: number; website: number }>();
  for (const m of metrics ?? []) {
    const row = metricsMap.get(m.location_id) ?? { calls: 0, directions: 0, website: 0 };
    row.calls += m.calls; row.directions += m.direction_requests; row.website += m.website_clicks;
    metricsMap.set(m.location_id, row);
  }
  const reviewMap = new Map((reviewStats ?? []).map(r => [r.location_id, r]));
  const fetchMap = new Map((fetchState ?? []).map(f => [f.location_id, f.last_status]));

  const rows = locs.map(l => {
    const mm = metricsMap.get(l.id) ?? { calls: 0, directions: 0, website: 0 };
    const rr = reviewMap.get(l.id);
    const status = fetchMap.get(l.id) ?? "never";
    return {
      id: l.id,
      title: l.title,
      address: l.address,
      phone: l.primary_phone,
      website: l.website_uri,
      calls: mm.calls,
      directions: mm.directions,
      website_clicks: mm.website,
      avg_rating: rr?.average_rating ?? null,
      total_reviews: rr?.total_reviews ?? 0,
      last_review_fetch: rr?.last_fetched_at ?? null,
      metrics_status: status,
    };
  });

  return NextResponse.json({ rows, range: { key: rangeKey, label, start: startYmd, end: endYmd } });
}
