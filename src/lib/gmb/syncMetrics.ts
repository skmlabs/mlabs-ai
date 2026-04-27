import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDailyMetrics, setMetricFetchState, upsertDailyMetrics } from "@/lib/gmb/performance";

export interface MetricsSyncResult {
  ok: number;
  pending: number;
  errors: number;
  total: number;
}

// Per-user GMB Performance metrics sync. Mirrors the inline loop in
// /api/gmb/sync-now/route.ts but is callable from anywhere (notably the
// post-OAuth auto-sync) and uses the service-role client so it doesn't
// depend on cookie context.
//
// Default range: trailing 30 days, ending yesterday (GMB Performance API has
// a 24-48hr lag, so today's data isn't useful).
export async function syncGmbMetricsForUser(
  userId: string,
  options: { days?: number } = {},
): Promise<MetricsSyncResult> {
  const days = options.days ?? 30;
  const result: MetricsSyncResult = { ok: 0, pending: 0, errors: 0, total: 0 };

  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));

  const admin = createAdminClient();

  const { data: locRows, error: locErr } = await admin
    .from("locations")
    .select("id, location_resource_name, connected_account_id, gmb_account_id, is_active")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (locErr) throw new Error(`locations fetch failed: ${locErr.message}`);

  const metricLocs = (locRows ?? []).filter(l => l.gmb_account_id !== "manual" && l.location_resource_name);
  result.total = metricLocs.length;

  if (metricLocs.length === 0) return result;

  const accountIds = Array.from(new Set(metricLocs.map(l => l.connected_account_id)));
  const { data: accounts } = await admin
    .from("connected_accounts")
    .select("id, user_id, encrypted_refresh_token, status")
    .in("id", accountIds);
  const accountMap = new Map((accounts ?? []).map(a => [a.id, a]));

  for (const loc of metricLocs) {
    const account = accountMap.get(loc.connected_account_id);
    if (!account || account.status !== "active") continue;

    try {
      const fetchResult = await fetchDailyMetrics({
        account,
        locationResourceName: loc.location_resource_name,
        start,
        end,
      });

      if (fetchResult.status === "ok") {
        await upsertDailyMetrics({ userId, locationId: loc.id, rows: fetchResult.rows });
        await setMetricFetchState({ userId, locationId: loc.id, status: "ok" });
        result.ok += 1;
      } else if (fetchResult.status === "pending_api_access") {
        await setMetricFetchState({ userId, locationId: loc.id, status: "pending_api_access" });
        result.pending += 1;
      } else {
        await setMetricFetchState({ userId, locationId: loc.id, status: "error", errorMessage: fetchResult.message });
        result.errors += 1;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      await setMetricFetchState({ userId, locationId: loc.id, status: "error", errorMessage: msg });
      result.errors += 1;
    }
  }

  return result;
}
