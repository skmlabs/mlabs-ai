import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildInsightsContext } from "@/lib/ai/buildInsightsContext";
import { buildInsightsPrompt } from "@/lib/ai/insightsPrompt";
import { generateWithGemini } from "@/lib/ai/gemini";
import { getCachedInsights, setCachedInsights } from "@/lib/ai/insightsCache";

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

  try {
    if (!force) {
      const cached = await getCachedInsights(user.id, timeRangeDays);
      if (cached) {
        return NextResponse.json({ insights: cached, cached: true });
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

    return NextResponse.json({ insights, cached: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI Insights generation failed";
    console.error("AI Insights generation failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
