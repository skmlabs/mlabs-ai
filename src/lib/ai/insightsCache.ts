// Upstash REST cache for AI Insights — 7-day TTL.
// Gracefully no-ops when REDIS_URL/REDIS_TOKEN are missing so the app still
// functions (every request just re-hits Gemini ≈ 30s + ~$0.02 per call).

const TTL_SECONDS = 7 * 24 * 60 * 60;

function cacheKey(userId: string, timeRangeDays: number): string {
  return `mlabs_ai_insights_${userId}_${timeRangeDays}d`;
}

function envPair(): { url: string; token: string } | null {
  const url = process.env.REDIS_URL;
  const token = process.env.REDIS_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export async function getCachedInsights(
  userId: string,
  timeRangeDays: number,
): Promise<string | null> {
  const env = envPair();
  if (!env) return null;

  const key = cacheKey(userId, timeRangeDays);
  try {
    const res = await fetch(`${env.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${env.token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json() as { result?: string | null };
    return typeof data.result === "string" ? data.result : null;
  } catch (e) {
    // Cache failure must never break the app — just log and miss.
    console.error("Redis get failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function setCachedInsights(
  userId: string,
  timeRangeDays: number,
  insights: string,
): Promise<void> {
  const env = envPair();
  if (!env) return;

  const key = cacheKey(userId, timeRangeDays);
  try {
    // Upstash REST SET with EX: POST to /set/{key}?EX=ttl with the value as
    // raw body (not JSON-wrapped — Upstash stores the body verbatim).
    const res = await fetch(`${env.url}/set/${encodeURIComponent(key)}?EX=${TTL_SECONDS}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "text/plain",
      },
      body: insights,
    });
    if (!res.ok) {
      console.error("Redis set failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("Redis set failed:", e instanceof Error ? e.message : e);
  }
}
