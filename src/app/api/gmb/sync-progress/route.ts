import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSyncProgress } from "@/lib/sync/progress";

export const runtime = "nodejs";

// Lightweight poll endpoint for the Settings "Auto-sync" UI. Returns:
//   { status: "idle" }                                      — no progress key (Redis missing or sync hasn't started)
//   { status: "running", total, completed, startedAt }      — Places sync chunk in flight
//   { status: "complete", total, completed, completedAt }   — Places sync finished
//
// Polled every ~1s by the page; bails on "complete" or after a hard cap.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const progress = await getSyncProgress(user.id);
  if (!progress) return NextResponse.json({ status: "idle" });
  return NextResponse.json(progress);
}
