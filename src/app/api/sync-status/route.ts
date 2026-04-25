import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Returns the most recent sync timestamp across both metric_fetch_state and
// review_sync_state, plus an in_progress flag if any review sync is still
// running. The dashboard uses this to render "Last synced X ago".
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: metricRows }, { data: reviewRows }] = await Promise.all([
    supabase
      .from("metric_fetch_state")
      .select("last_fetched_at")
      .eq("user_id", user.id)
      .order("last_fetched_at", { ascending: false, nullsFirst: false })
      .limit(1),
    supabase
      .from("review_sync_state")
      .select("last_synced_at, last_sync_status")
      .eq("user_id", user.id)
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .limit(50),
  ]);

  const metricTime = metricRows?.[0]?.last_fetched_at ?? null;
  const reviewTime = reviewRows?.[0]?.last_synced_at ?? null;

  const candidates = [metricTime, reviewTime].filter((v): v is string => typeof v === "string");
  const latest = candidates.length > 0
    ? candidates.reduce((a, b) => (a > b ? a : b))
    : null;

  const inProgress = (reviewRows ?? []).some(r => r.last_sync_status === "in_progress");

  return NextResponse.json({
    last_synced_at: latest,
    in_progress: inProgress,
    metric_last_synced_at: metricTime,
    review_last_synced_at: reviewTime,
  });
}
