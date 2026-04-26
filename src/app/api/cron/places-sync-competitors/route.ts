import { NextRequest, NextResponse } from "next/server";
import { syncAllCompetitors } from "@/lib/places/syncCompetitors";

export const runtime = "nodejs";
export const maxDuration = 300;

// Weekly cron — Vercel sends `Authorization: Bearer ${CRON_SECRET}` per the
// schedule registered in vercel.json (Sun 20:30 UTC = Mon 02:00 IST).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;
  if (!expected || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncAllCompetitors();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Cron sync failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
