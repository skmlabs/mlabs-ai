import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canBypassRegenerateGate } from "@/lib/ai/insightsCache";
import { diagnoseRedisEnv, pingRedisRest } from "@/lib/redis/env";

export const runtime = "nodejs";

// SK-only Redis diagnostic. Returns BOTH the live ping result AND a
// structured view of which Redis-shaped env vars the Node runtime can see —
// names + URL protocol prefix only, no values, so it's safe to read.
//
// Use the `diagnostic` block to triangulate failures:
//   - redisLikeKeys empty                      → env vars not propagating
//                                                (check Vercel scope/redeploy)
//   - REDIS_URL present, urlFormat: "redis"    → wrong URL value — paste the
//                                                REST URL from Upstash's
//                                                "REST API" tab, not the
//                                                "Redis" tab's redis:// URL
//   - REDIS_URL present, urlFormat: "https",
//     ping ok: true                            → fully working
//   - REDIS_URL present, urlFormat: "https",
//     ping ok: false, status: 401              → token wrong/expired
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canBypassRegenerateGate(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ping = await pingRedisRest();
  const diagnostic = diagnoseRedisEnv();
  return NextResponse.json({ ...ping, diagnostic });
}
