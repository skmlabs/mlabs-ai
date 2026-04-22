import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { fetchDailyMetrics, setMetricFetchState, upsertDailyMetrics } from "@/lib/gmb/performance";
import { getDateRange } from "@/lib/dateRange";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const rangeKey = (searchParams.get("range") ?? "28d") as "yesterday" | "7d" | "28d" | "90d";
  const { start, end } = getDateRange(rangeKey);

  // Get all active locations + their connected account
  const { data: rows, error } = await supabase
    .from("locations")
    .select("id, location_resource_name, connected_account_id")
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ ok: true, synced: 0 });

  // Fetch connected_accounts once
  const accountIds = Array.from(new Set(rows.map(r => r.connected_account_id)));
  const { data: accounts, error: aerr } = await supabase
    .from("connected_accounts")
    .select("id, user_id, encrypted_refresh_token, status")
    .in("id", accountIds);
  if (aerr) return NextResponse.json({ error: aerr.message }, { status: 500 });
  const accountMap = new Map(accounts?.map(a => [a.id, a]) ?? []);

  let ok = 0, pending = 0, errors = 0;
  for (const loc of rows) {
    const account = accountMap.get(loc.connected_account_id);
    if (!account || account.status !== "active") continue;
    try {
      const result = await fetchDailyMetrics({ account, locationResourceName: loc.location_resource_name, start, end });
      if (result.status === "ok") {
        await upsertDailyMetrics({ userId: user.id, locationId: loc.id, rows: result.rows });
        await setMetricFetchState({ userId: user.id, locationId: loc.id, status: "ok" });
        ok++;
      } else if (result.status === "pending_api_access") {
        await setMetricFetchState({ userId: user.id, locationId: loc.id, status: "pending_api_access" });
        pending++;
      } else {
        await setMetricFetchState({ userId: user.id, locationId: loc.id, status: "error", errorMessage: result.message });
        errors++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      await setMetricFetchState({ userId: user.id, locationId: loc.id, status: "error", errorMessage: msg });
      errors++;
    }
  }
  return NextResponse.json({ ok: true, totalLocations: rows.length, synced: ok, pendingApiAccess: pending, errors });
}
