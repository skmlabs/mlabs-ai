import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildInsightsContext } from "@/lib/ai/buildInsightsContext";
import { buildInsightsPrompt } from "@/lib/ai/insightsPrompt";
import { generateWithGemini } from "@/lib/ai/gemini";
import {
  canBypassRegenerateGate,
  getCachedInsights,
  getRegenerateLockBody,
  getRegenerateLockTtl,
  setCachedInsights,
  setRegenerateLock,
} from "@/lib/ai/insightsCache";

export const runtime = "nodejs";
// Gemini 2.5 Pro can take 20-40s on a fresh generation; give Vercel headroom.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const force = sp.get("force") === "1";
  const parsedDays = parseInt(sp.get("days") ?? "7", 10);
  const timeRangeDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 7;

  const isSkAccount = canBypassRegenerateGate(user.email);

  // Cooldown gate — applies only to forced regenerations and only for non-SK
  // accounts. The Redis no-op fallback means the lock silently doesn't enforce
  // until REDIS_URL/REDIS_TOKEN are provisioned (acceptable for v1; cost
  // protection kicks in once Redis lands).
  if (force && !isSkAccount) {
    const lockTtl = await getRegenerateLockTtl(user.id);
    if (lockTtl !== null) {
      const hoursRemaining = Math.max(1, Math.ceil(lockTtl / 3600));
      return NextResponse.json({
        error: `AI Insights can be regenerated once every 24 hours. Try again in ${hoursRemaining} hour${hoursRemaining === 1 ? "" : "s"}.`,
        retryAfter: lockTtl,
        regenerateLockedUntilHours: hoursRemaining,
      }, { status: 429 });
    }
  }

  try {
    if (!force) {
      const cached = await getCachedInsights(user.id, timeRangeDays);
      if (cached) {
        // The lock body holds the ISO timestamp of the most recent generation
        // (see setRegenerateLock — written after every successful generation
        // since this commit). Surfaced to the UI so the page can render
        // "Last regenerated on X" without a second timestamp source.
        const lastRegeneratedAt = await getRegenerateLockBody(user.id);
        return NextResponse.json({ insights: cached, cached: true, lastRegeneratedAt });
      }
    }

    const context = await buildInsightsContext(user.id, timeRangeDays);

    if (context.locations.length === 0) {
      return NextResponse.json({
        error: "No locations connected. Please connect a location to generate insights.",
      }, { status: 400 });
    }

    const prompt = buildInsightsPrompt(context);
    const insights = await generateWithGemini(prompt);

    await setCachedInsights(user.id, timeRangeDays, insights);

    // Always write the lock after a successful generation so the UI has a
    // consistent "last regenerated" timestamp for both SK (bypassed gate)
    // and non-SK users (gated). For non-SK, the gate check above still
    // enforces 24h between forced regenerations.
    await setRegenerateLock(user.id);
    const lastRegeneratedAt = new Date().toISOString();

    return NextResponse.json({ insights, cached: false, lastRegeneratedAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI Insights generation failed";
    console.error("AI Insights generation failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
