import { NextRequest, NextResponse } from "next/server";
import { syncAllOwnedLocations } from "@/lib/places/syncOwnedLocations";

export const runtime = "nodejs";
export const maxDuration = 300;

// Daily cron — Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically
// per the cron job config. Schedule registered in vercel.json.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAllOwnedLocations();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cron sync failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
