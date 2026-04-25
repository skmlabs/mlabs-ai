import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchReviewsForAllLocations } from "@/lib/gmb/reviewsApi";

export const runtime = "nodejs";
// Big multi-location syncs can run several minutes — give Vercel headroom.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  // Two callers: (1) authenticated user via UI, (2) cron via x-internal-secret.
  const internalSecret = req.headers.get("x-internal-secret");
  let userId: string | null = null;

  if (internalSecret && process.env.CRON_SECRET && internalSecret === process.env.CRON_SECRET) {
    const body = await req.json().catch(() => ({}));
    userId = typeof (body as { user_id?: unknown }).user_id === "string"
      ? (body as { user_id: string }).user_id
      : null;
  } else {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = user.id;
  }

  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  try {
    const result = await fetchReviewsForAllLocations(userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sync failed";
    console.error("sync-full error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
