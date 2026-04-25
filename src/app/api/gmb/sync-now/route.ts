import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchDailyMetrics, setMetricFetchState, upsertDailyMetrics } from "@/lib/gmb/performance";
import { fetchReviewsForAllLocations } from "@/lib/gmb/reviewsApi";
import { getDateRange, isValidYMD, normalizeRangeKey } from "@/lib/dateRange";

export const runtime = "nodejs";
export const maxDuration = 300;

// One-shot "Sync now" — runs metrics sync (over the active range) and a full
// review sync side-by-side. The dashboard uses this for the user-facing button.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const rangeKey = normalizeRangeKey(sp.get("range"));
  const customStart = sp.get("start");
  const customEnd = sp.get("end");
  const custom = rangeKey === "custom" && isValidYMD(customStart) && isValidYMD(customEnd)
    ? { start: customStart, end: customEnd } : undefined;
  const { start, end } = getDateRange(rangeKey, custom);

  // Fetch active locations + their connected_accounts ONCE for metrics.
  const { data: locRows, error: locErr } = await supabase
    .from("locations")
    .select("id, location_resource_name, connected_account_id, gmb_account_id, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (locErr) return NextResponse.json({ error: locErr.message }, { status: 500 });

  const metricLocs = (locRows ?? []).filter(l => l.gmb_account_id !== "manual" && l.location_resource_name);
  const accountIds = Array.from(new Set(metricLocs.map(l => l.connected_account_id)));

  let metricsOk = 0, metricsPending = 0, metricsErrors = 0;
  if (accountIds.length > 0) {
    const { data: accounts } = await supabase
      .from("connected_accounts")
      .select("id, user_id, encrypted_refresh_token, status")
      .in("id", accountIds);
    const accountMap = new Map((accounts ?? []).map(a => [a.id, a]));

    for (const loc of metricLocs) {
      const account = accountMap.get(loc.connected_account_id);
      if (!account || account.status !== "active") continue;
      try {
        const result = await fetchDailyMetrics({
          account,
          locationResourceName: loc.location_resource_name,
          start,
          end,
        });
        if (result.status === "ok") {
          await upsertDailyMetrics({ userId: user.id, locationId: loc.id, rows: result.rows });
          await setMetricFetchState({ userId: user.id, locationId: loc.id, status: "ok" });
          metricsOk++;
        } else if (result.status === "pending_api_access") {
          await setMetricFetchState({ userId: user.id, locationId: loc.id, status: "pending_api_access" });
          metricsPending++;
        } else {
          await setMetricFetchState({ userId: user.id, locationId: loc.id, status: "error", errorMessage: result.message });
          metricsErrors++;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        await setMetricFetchState({ userId: user.id, locationId: loc.id, status: "error", errorMessage: msg });
        metricsErrors++;
      }
    }
  }

  // Reviews — full GMB API sync (paginated, all reviews per location).
  let reviewsTotal = 0, reviewsLocations = 0, reviewsError: string | undefined;
  try {
    const r = await fetchReviewsForAllLocations(user.id);
    reviewsTotal = r.total_fetched;
    reviewsLocations = r.per_location.length;
  } catch (e) {
    reviewsError = e instanceof Error ? e.message : "Review sync failed";
    console.error("sync-now reviews error:", reviewsError);
  }

  return NextResponse.json({
    ok: true,
    metrics: { ok: metricsOk, pending_api_access: metricsPending, errors: metricsErrors },
    reviews: { total_fetched: reviewsTotal, locations: reviewsLocations, error: reviewsError ?? null },
  });
}
