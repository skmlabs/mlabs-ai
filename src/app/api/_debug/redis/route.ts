import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canBypassRegenerateGate } from "@/lib/ai/insightsCache";
import { pingRedisRest } from "@/lib/redis/env";

export const runtime = "nodejs";

// One-shot diagnostic — gated to founder/operator accounts so it doesn't leak
// connectivity state to anyone authed.
//
// Returns:
//   { source: "REDIS_URL/REDIS_TOKEN", ok: true, status: 200 }
//     → credentials work end-to-end
//   { source: "REDIS_URL/REDIS_TOKEN", ok: false, status: 401, error: "..." }
//     → URL resolved but token rejected (likely token typo)
//   { source: null, error: "No usable env var pair found." }
//     → all candidates either missing or non-https. Check Vercel runtime logs
//       for [redis] warnings — they'll name the failing pair.
//   { source: null, error: "Forbidden" } with 403
//     → not signed in as an SK account.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canBypassRegenerateGate(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await pingRedisRest();
  return NextResponse.json(result);
}
