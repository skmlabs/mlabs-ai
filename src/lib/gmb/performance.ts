import { decrypt } from "@/lib/crypto";
import { refreshAccessToken } from "./oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DailyMetricRow } from "@/lib/types";

// Metrics we'll fetch from the Business Profile Performance API
const DAILY_METRICS = [
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
] as const;

type ApiMetricKey = typeof DAILY_METRICS[number];

function mapMetricKey(apiKey: ApiMetricKey): keyof DailyMetricRow | null {
  switch (apiKey) {
    case "CALL_CLICKS": return "calls";
    case "WEBSITE_CLICKS": return "website_clicks";
    case "BUSINESS_DIRECTION_REQUESTS": return "direction_requests";
    case "BUSINESS_IMPRESSIONS_DESKTOP_MAPS": return "business_impressions_desktop_maps";
    case "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH": return "business_impressions_desktop_search";
    case "BUSINESS_IMPRESSIONS_MOBILE_MAPS": return "business_impressions_mobile_maps";
    case "BUSINESS_IMPRESSIONS_MOBILE_SEARCH": return "business_impressions_mobile_search";
    default: return null;
  }
}

type StoredAccount = { id: string; user_id: string; encrypted_refresh_token: string };

async function getAccessToken(account: StoredAccount): Promise<string> {
  const refreshToken = decrypt(account.encrypted_refresh_token);
  const t = await refreshAccessToken(refreshToken);
  return t.access_token;
}

// Returns ok with rows, OR pending_api_access when Google returns quota=0 errors (Basic Access pending)
export async function fetchDailyMetrics(params: {
  account: StoredAccount;
  locationResourceName: string; // e.g. "locations/12345..."
  start: Date;
  end: Date;
}): Promise<{ status: "ok"; rows: DailyMetricRow[] } | { status: "pending_api_access"; rows: [] } | { status: "error"; message: string }> {
  const accessToken = await getAccessToken(params.account);
  const url = new URL(`https://businessprofileperformance.googleapis.com/v1/${params.locationResourceName}:fetchMultiDailyMetricsTimeSeries`);
  for (const m of DAILY_METRICS) url.searchParams.append("dailyMetrics", m);
  url.searchParams.set("dailyRange.startDate.year", String(params.start.getUTCFullYear()));
  url.searchParams.set("dailyRange.startDate.month", String(params.start.getUTCMonth() + 1));
  url.searchParams.set("dailyRange.startDate.day", String(params.start.getUTCDate()));
  url.searchParams.set("dailyRange.endDate.year", String(params.end.getUTCFullYear()));
  url.searchParams.set("dailyRange.endDate.month", String(params.end.getUTCMonth() + 1));
  url.searchParams.set("dailyRange.endDate.day", String(params.end.getUTCDate()));

  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    const text = await res.text();
    // Quota exceeded / API not enabled -> pending_api_access
    if (res.status === 429 || /quota|RESOURCE_EXHAUSTED|quota_limit_value"\s*:\s*"0"/i.test(text)) {
      return { status: "pending_api_access", rows: [] };
    }
    if (res.status === 403 || res.status === 404) {
      // 404 is also what Google returns when Basic Access is not granted
      if (/PERMISSION_DENIED|not enabled|not.*authorized|Error 404/i.test(text)) {
        return { status: "pending_api_access", rows: [] };
      }
    }
    return { status: "error", message: `${res.status}: ${text.slice(0, 300)}` };
  }
  const data = await res.json() as { multiDailyMetricTimeSeries?: Array<{ dailyMetricTimeSeries?: Array<{ dailyMetric: ApiMetricKey; timeSeries?: { datedValues?: Array<{ date: { year: number; month: number; day: number }; value?: string }> } }> }> };

  // Build date -> metric -> count map
  const byDate = new Map<string, DailyMetricRow>();
  for (const outer of data.multiDailyMetricTimeSeries ?? []) {
    for (const series of outer.dailyMetricTimeSeries ?? []) {
      const colKey = mapMetricKey(series.dailyMetric);
      if (!colKey) continue;
      for (const dv of series.timeSeries?.datedValues ?? []) {
        const ymd = `${dv.date.year}-${String(dv.date.month).padStart(2, "0")}-${String(dv.date.day).padStart(2, "0")}`;
        let row = byDate.get(ymd);
        if (!row) {
          row = {
            metric_date: ymd,
            calls: 0,
            direction_requests: 0,
            website_clicks: 0,
            business_impressions_desktop_maps: 0,
            business_impressions_desktop_search: 0,
            business_impressions_mobile_maps: 0,
            business_impressions_mobile_search: 0,
          };
          byDate.set(ymd, row);
        }
        (row[colKey] as number) = Number(dv.value ?? 0);
      }
    }
  }
  return { status: "ok", rows: Array.from(byDate.values()).sort((a, b) => a.metric_date.localeCompare(b.metric_date)) };
}

export async function upsertDailyMetrics(params: { userId: string; locationId: string; rows: DailyMetricRow[] }): Promise<void> {
  if (params.rows.length === 0) return;
  const admin = createAdminClient();
  const payload = params.rows.map(r => ({ user_id: params.userId, location_id: params.locationId, ...r }));
  await admin.from("daily_metrics").upsert(payload, { onConflict: "location_id,metric_date" });
}

export async function setMetricFetchState(params: { userId: string; locationId: string; status: "ok" | "pending_api_access" | "error"; errorMessage?: string }): Promise<void> {
  const admin = createAdminClient();
  await admin.from("metric_fetch_state").upsert({
    location_id: params.locationId,
    user_id: params.userId,
    last_fetched_at: new Date().toISOString(),
    last_status: params.status,
    last_error: params.errorMessage ?? null,
  }, { onConflict: "location_id" });
}
