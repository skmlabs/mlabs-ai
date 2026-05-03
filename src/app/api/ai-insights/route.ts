import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildInsightsContext } from "@/lib/ai/buildInsightsContext";
import { buildInsightsPrompt } from "@/lib/ai/insightsPrompt";
import { generateJSONWithGemini } from "@/lib/ai/gemini";
import {
  canBypassRegenerateGate,
  getCachedInsightsV2,
  getRegenerateLockBody,
  getRegenerateLockTtl,
  setCachedInsightsV2,
  setRegenerateLock,
  wipeV1CacheOnce,
  wipeV2CacheOnce,
} from "@/lib/ai/insightsCache";
import type { AIInsightsResponse } from "@/lib/types/aiInsights";

export const runtime = "nodejs";
// Gemini 2.5 Pro can take 30-50s on a 16k-token JSON brief; give Vercel headroom.
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // One-shot v1 + v2 cache wipes. Both idempotent via Redis flags — fast-path
  // after first post-deploy invocation. Logs a single line each when the wipe
  // actually runs; silent thereafter. v2 wipe handles the v2 → v2_1
  // schema-bump rollout (chart_data).
  await wipeV1CacheOnce();
  await wipeV2CacheOnce();

  const sp = req.nextUrl.searchParams;
  const force = sp.get("force") === "1";
  const parsedDays = parseInt(sp.get("days") ?? "7", 10);
  const timeRangeDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 7;

  const isSkAccount = canBypassRegenerateGate(user.email);

  // 24h cooldown gate — applies only to forced regenerations and only for
  // non-SK accounts. Unchanged from v1.
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
      const cachedRaw = await getCachedInsightsV2(user.id, timeRangeDays);
      if (cachedRaw) {
        // Cached payload is JSON.stringify(validatedAIInsightsResponse).
        // Validation passed at write-time so we trust the shape on read.
        let cachedInsights: AIInsightsResponse;
        try {
          cachedInsights = JSON.parse(cachedRaw) as AIInsightsResponse;
        } catch {
          // Corrupt cache entry — fall through to fresh generation rather
          // than serving garbage. This is a recoverable failure mode.
          cachedInsights = null as unknown as AIInsightsResponse;
        }
        if (cachedInsights) {
          const lastRegeneratedAt = await getRegenerateLockBody(user.id);
          return NextResponse.json({ insights: cachedInsights, cached: true, lastRegeneratedAt });
        }
      }
    }

    const context = await buildInsightsContext(user.id, timeRangeDays);

    if (context.locations.length === 0) {
      return NextResponse.json({
        error: "No locations connected. Please connect a location to generate insights.",
      }, { status: 400 });
    }

    const prompt = buildInsightsPrompt(context);

    // First attempt + 1 retry on validation/parse failure. Per Phase 1 spec:
    // if both attempts fail, return 502 with a structured error — never
    // silently fall back to a partial / unstructured response.
    let validated: AIInsightsResponse | null = null;
    let lastFailure: string | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const raw = await generateJSONWithGemini(prompt);
        const stripped = stripCodeFences(raw);
        const parsed = JSON.parse(stripped) as unknown;
        const result = validateAIInsightsResponse(parsed);
        if (result.ok) {
          validated = result.value;
          break;
        }
        lastFailure = `validation: ${result.error}`;
        console.warn(`[ai-insights] attempt ${attempt} ${lastFailure}`);
      } catch (e) {
        lastFailure = `parse: ${e instanceof Error ? e.message : String(e)}`;
        console.warn(`[ai-insights] attempt ${attempt} ${lastFailure}`);
      }
    }

    if (!validated) {
      console.error(`[ai-insights] generation failed after 2 attempts. Last failure: ${lastFailure}`);
      return NextResponse.json({
        error: "generation_failed",
        message: "Could not generate structured insights. Please try again.",
      }, { status: 502 });
    }

    // Persist + lock + return.
    await setCachedInsightsV2(user.id, timeRangeDays, JSON.stringify(validated));
    await setRegenerateLock(user.id);
    const lastRegeneratedAt = new Date().toISOString();

    return NextResponse.json({ insights: validated, cached: false, lastRegeneratedAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI Insights generation failed";
    console.error("[ai-insights] route error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Defensive fence-stripper. responseMimeType="application/json" usually
// produces clean JSON, but Gemini occasionally still wraps in ```json fences.
function stripCodeFences(s: string): string {
  let trimmed = s.trim();
  if (trimmed.startsWith("```json")) trimmed = trimmed.slice(7).trim();
  else if (trimmed.startsWith("```")) trimmed = trimmed.slice(3).trim();
  if (trimmed.endsWith("```")) trimmed = trimmed.slice(0, -3).trim();
  return trimmed;
}

// Shape-validate the parsed JSON against the AIInsightsResponse contract.
// Returns the FIRST failure to keep logs readable; on success, narrows the
// type via the validated value (caller doesn't need a second cast).
function validateAIInsightsResponse(
  raw: unknown,
): { ok: true; value: AIInsightsResponse } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "not an object" };
  const obj = raw as Record<string, unknown>;

  const topLevelKeys = [
    "scorecard",
    "executive_summary",
    "themes",
    "sentiment_trend",
    "competitive_comparison",
    "catchment_intelligence",
    "recommendations",
    "chart_data",
  ] as const;
  for (const key of topLevelKeys) {
    if (!(key in obj)) return { ok: false, error: `missing top-level key: ${key}` };
  }

  const scorecard = obj.scorecard;
  if (!scorecard || typeof scorecard !== "object") {
    return { ok: false, error: "scorecard not an object" };
  }
  const scorecardObj = scorecard as Record<string, unknown>;
  const scorecardKeys = ["rating", "reviews", "velocity", "competitive_position", "sentiment"] as const;
  for (const key of scorecardKeys) {
    if (!(key in scorecardObj)) return { ok: false, error: `missing scorecard sub-key: ${key}` };
  }

  if (!Array.isArray(obj.themes) || obj.themes.length < 1) {
    return { ok: false, error: "themes must be a non-empty array" };
  }
  if (!Array.isArray(obj.recommendations) || obj.recommendations.length < 1) {
    return { ok: false, error: "recommendations must be a non-empty array" };
  }

  const cc = obj.competitive_comparison;
  if (!cc || typeof cc !== "object") {
    return { ok: false, error: "competitive_comparison not an object" };
  }
  const ccObj = cc as Record<string, unknown>;
  if (!Array.isArray(ccObj.rows) || ccObj.rows.length !== 5) {
    return { ok: false, error: "competitive_comparison.rows must have exactly 5 entries" };
  }

  const cd = obj.chart_data;
  if (!cd || typeof cd !== "object") {
    return { ok: false, error: "chart_data not an object" };
  }
  const cdObj = cd as Record<string, unknown>;
  for (const key of ["review_velocity_90d", "competitive_bars", "theme_frequency", "chart_findings"] as const) {
    if (!Array.isArray(cdObj[key])) return { ok: false, error: `chart_data.${key} must be an array` };
  }

  return { ok: true, value: obj as unknown as AIInsightsResponse };
}
