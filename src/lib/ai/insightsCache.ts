// Upstash REST cache for AI Insights — 7-day TTL.
// Gracefully no-ops when no Redis credentials are resolvable so the app still
// functions (every request just re-hits Gemini ≈ 30s + ~$0.02 per call).
// See src/lib/redis/env.ts for the env-var resolution + format validation.

import { resolveRedisRest } from "@/lib/redis/env";

const TTL_SECONDS = 7 * 24 * 60 * 60;
// Regenerate cooldown is separate from cache TTL — controls "how often a user
// can trigger fresh generation" rather than "how long the cached output is
// considered fresh." 24h matches the typical operator cadence.
const REGENERATE_LOCK_TTL_SECONDS = 24 * 60 * 60;

// Bypass the regenerate cooldown for these accounts (case-insensitive).
// Founder/operator accounts that need ad-hoc regeneration during demos.
const SK_BYPASS_EMAILS = ["sk@mlabsdigital.org", "sushant.iiml@gmail.com"];

function cacheKey(userId: string, timeRangeDays: number): string {
  return `mlabs_ai_insights_${userId}_${timeRangeDays}d`;
}

function regenerateLockKey(userId: string): string {
  return `mlabs_ai_regenerate_lock_${userId}`;
}

export function canBypassRegenerateGate(email: string | null | undefined): boolean {
  if (!email) return false;
  return SK_BYPASS_EMAILS.includes(email.toLowerCase().trim());
}

function envPair(): { url: string; token: string } | null {
  return resolveRedisRest();
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

// Returns the lock's stored body (an ISO timestamp written at the moment of
// the lock-set, see setRegenerateLock) or null if the key is absent. Used by
// the AI Insights page to render "Last regenerated on X" without introducing
// a second timestamp source.
export async function getRegenerateLockBody(userId: string): Promise<string | null> {
  const env = envPair();
  if (!env) return null;

  const key = regenerateLockKey(userId);
  try {
    const res = await fetch(`${env.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${env.token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json() as { result?: string | null };
    return typeof data.result === "string" ? data.result : null;
  } catch (e) {
    console.error("Redis get lock body failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// Returns the remaining cooldown in seconds when a lock is active, else null.
// Upstash /ttl returns -2 if the key doesn't exist, -1 if it exists without a
// TTL — both mean "not locked" for our purposes.
export async function getRegenerateLockTtl(userId: string): Promise<number | null> {
  const env = envPair();
  if (!env) return null;

  const key = regenerateLockKey(userId);
  try {
    const res = await fetch(`${env.url}/ttl/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${env.token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json() as { result?: number };
    const ttl = data.result;
    if (typeof ttl !== "number" || ttl < 0) return null;
    return ttl;
  } catch (e) {
    console.error("Redis ttl failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function setRegenerateLock(userId: string): Promise<void> {
  const env = envPair();
  if (!env) return;

  const key = regenerateLockKey(userId);
  try {
    const res = await fetch(`${env.url}/set/${encodeURIComponent(key)}?EX=${REGENERATE_LOCK_TTL_SECONDS}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "text/plain",
      },
      // Body content doesn't matter — we only check key existence + TTL.
      body: new Date().toISOString(),
    });
    if (!res.ok) {
      console.error("Redis set lock failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("Redis set lock failed:", e instanceof Error ? e.message : e);
  }
}
