import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchReviewsForAllLocations } from "@/lib/gmb/reviewsApi";

export const runtime = "nodejs";
export const maxDuration = 300;

// Daily auto-sync. Vercel sends GET with x-vercel-cron-secret per project setting;
// we accept either that header or ?secret= for manual re-runs.
export async function GET(req: NextRequest) {
  const supplied = req.headers.get("x-vercel-cron-secret") ?? req.nextUrl.searchParams.get("secret");
  if (!process.env.CRON_SECRET || supplied !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Sync only users that actually have an active GMB connection — skip free users
  // who never connected (no work to do, no quota to spend).
  const { data: accounts } = await admin
    .from("connected_accounts")
    .select("user_id")
    .eq("status", "active")
    .eq("provider", "gmb");

  const userIds = Array.from(new Set((accounts ?? []).map(a => a.user_id)));
  if (userIds.length === 0) return NextResponse.json({ ok: true, users_synced: 0, results: [] });

  const results: { user_id: string; total_fetched: number; locations: number; error?: string }[] = [];
  for (const uid of userIds) {
    try {
      const r = await fetchReviewsForAllLocations(uid);
      results.push({ user_id: uid, total_fetched: r.total_fetched, locations: r.per_location.length });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      console.error(`Cron sync error for user ${uid}:`, msg);
      results.push({ user_id: uid, total_fetched: 0, locations: 0, error: msg });
    }
  }

  return NextResponse.json({ ok: true, users_synced: results.length, results });
}
