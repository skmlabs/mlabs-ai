import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncOwnedLocationsForUser } from "@/lib/places/syncOwnedLocations";

export const runtime = "nodejs";
export const maxDuration = 300;

// Manual user-triggered Places sync. The cron route handles the daily sweep.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await syncOwnedLocationsForUser(user.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
