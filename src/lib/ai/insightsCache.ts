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

// v2_1 cache key — the v2.1 pipeline (with chart_data) stores
// JSON.stringify(AIInsightsResponse). Same TTL as v1 (TTL_SECONDS). Separate
// key prefix so old v2 caches can be wiped post-deploy without races.
function cacheKeyV2(userId: string, timeRangeDays: number): string {
  return `mlabs_ai_insights_v2_1_${userId}_${timeRangeDays}d`;
}

const V1_WIPED_FLAG_KEY = "mlabs_ai_v1_wiped";
const V1_SCAN_PATTERN = "mlabs_ai_insights_*";
// V2_KEY_PREFIX protects BOTH old v2 AND new v2_1 keys from the v1 wipe
// (since "mlabs_ai_insights_v2_1_…" still starts with "mlabs_ai_insights_v2_").
const V2_KEY_PREFIX = "mlabs_ai_insights_v2_";

// v2 wipe — removes orphan v2 keys (no chart_data) after the v2_1 rollout.
const V2_WIPED_FLAG_KEY = "mlabs_ai_v2_wiped";
const V2_SCAN_PATTERN = "mlabs_ai_insights_v2_*";        // matches v2 + v2_1
const V2_1_KEY_PREFIX = "mlabs_ai_insights_v2_1_";       // exclude active cache from v2 wipe

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

// v2 cache read — returns the JSON-stringified payload (caller does
// JSON.parse). Returns null on miss or any Redis failure.
export async function getCachedInsightsV2(
  userId: string,
  timeRangeDays: number,
): Promise<string | null> {
  const env = envPair();
  if (!env) return null;

  const key = cacheKeyV2(userId, timeRangeDays);
  try {
    const res = await fetch(`${env.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${env.token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json() as { result?: string | null };
    return typeof data.result === "string" ? data.result : null;
  } catch (e) {
    console.error("Redis v2 get failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// v2 cache write — payload is JSON.stringify(validatedAIInsightsResponse).
// 7-day TTL same as v1.
export async function setCachedInsightsV2(
  userId: string,
  timeRangeDays: number,
  payload: string,
): Promise<void> {
  const env = envPair();
  if (!env) return;

  const key = cacheKeyV2(userId, timeRangeDays);
  try {
    const res = await fetch(`${env.url}/set/${encodeURIComponent(key)}?EX=${TTL_SECONDS}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "text/plain",
      },
      body: payload,
    });
    if (!res.ok) {
      console.error("Redis v2 set failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("Redis v2 set failed:", e instanceof Error ? e.message : e);
  }
}

// One-shot v1-cache wipe. Idempotent via a Redis flag — the first
// invocation post-deploy SCANs for `mlabs_ai_insights_*` keys (excluding
// v2's `mlabs_ai_insights_v2_*` since Redis MATCH globs lack negation),
// DELs each, then sets the `mlabs_ai_v1_wiped=1` flag with no TTL so
// subsequent invocations fast-path.
//
// Failure modes (Redis missing, SCAN error, DEL error, flag-set error)
// all degrade silently — wipe is best-effort, must never block the
// AI Insights request. Returns telemetry for caller logging.
export async function wipeV1CacheOnce(): Promise<{ wiped: number; skipped: boolean; reason?: string }> {
  const env = envPair();
  if (!env) return { wiped: 0, skipped: true, reason: "no-redis" };

  try {
    const flagRes = await fetch(`${env.url}/get/${encodeURIComponent(V1_WIPED_FLAG_KEY)}`, {
      headers: { Authorization: `Bearer ${env.token}` },
      cache: "no-store",
    });
    if (flagRes.ok) {
      const flagData = await flagRes.json() as { result?: string | null };
      if (flagData.result === "1") return { wiped: 0, skipped: true, reason: "already-wiped" };
    }

    // Paginated SCAN. Upstash returns [nextCursor, keys[]] in `result`.
    const v1Keys: string[] = [];
    let cursor = "0";
    let safetyHops = 0;
    do {
      safetyHops++;
      if (safetyHops > 200) {
        console.error("[redis] V1 wipe SCAN exceeded 200 hops — aborting");
        break;
      }
      const scanRes = await fetch(
        `${env.url}/scan/${encodeURIComponent(cursor)}?match=${encodeURIComponent(V1_SCAN_PATTERN)}&count=100`,
        { headers: { Authorization: `Bearer ${env.token}` }, cache: "no-store" },
      );
      if (!scanRes.ok) {
        console.error("Redis SCAN failed:", scanRes.status);
        return { wiped: 0, skipped: true, reason: `scan-${scanRes.status}` };
      }
      const scanData = await scanRes.json() as { result?: [string, string[]] };
      if (!scanData.result || !Array.isArray(scanData.result) || scanData.result.length < 2) break;
      const nextCursor = scanData.result[0];
      const batch = scanData.result[1];
      cursor = typeof nextCursor === "string" ? nextCursor : "0";
      if (Array.isArray(batch)) {
        for (const k of batch) {
          if (typeof k === "string" && !k.startsWith(V2_KEY_PREFIX)) v1Keys.push(k);
        }
      }
    } while (cursor !== "0");

    let wipedCount = 0;
    for (const key of v1Keys) {
      try {
        const delRes = await fetch(`${env.url}/del/${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${env.token}` },
        });
        if (delRes.ok) wipedCount++;
      } catch (e) {
        console.error("Redis DEL failed for key:", key, e instanceof Error ? e.message : e);
      }
    }

    // Set flag with no TTL so the next invocation skips entirely.
    await fetch(`${env.url}/set/${encodeURIComponent(V1_WIPED_FLAG_KEY)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "text/plain",
      },
      body: "1",
    });

    console.log(`[redis] V1 cache wipe complete — deleted ${wipedCount} of ${v1Keys.length} candidate key(s).`);
    return { wiped: wipedCount, skipped: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("V1 wipe failed:", msg);
    return { wiped: 0, skipped: true, reason: `error: ${msg.slice(0, 80)}` };
  }
}

// Same shape as wipeV1CacheOnce but for the v2 → v2_1 migration. Removes
// pre-chart_data v2 cache entries while leaving v2_1 entries intact.
export async function wipeV2CacheOnce(): Promise<{ wiped: number; skipped: boolean; reason?: string }> {
  const env = envPair();
  if (!env) return { wiped: 0, skipped: true, reason: "no-redis" };

  try {
    const flagRes = await fetch(`${env.url}/get/${encodeURIComponent(V2_WIPED_FLAG_KEY)}`, {
      headers: { Authorization: `Bearer ${env.token}` },
      cache: "no-store",
    });
    if (flagRes.ok) {
      const flagData = await flagRes.json() as { result?: string | null };
      if (flagData.result === "1") return { wiped: 0, skipped: true, reason: "already-wiped" };
    }

    const v2Keys: string[] = [];
    let cursor = "0";
    let safetyHops = 0;
    do {
      safetyHops++;
      if (safetyHops > 200) {
        console.error("[redis] V2 wipe SCAN exceeded 200 hops — aborting");
        break;
      }
      const scanRes = await fetch(
        `${env.url}/scan/${encodeURIComponent(cursor)}?match=${encodeURIComponent(V2_SCAN_PATTERN)}&count=100`,
        { headers: { Authorization: `Bearer ${env.token}` }, cache: "no-store" },
      );
      if (!scanRes.ok) {
        console.error("Redis V2 SCAN failed:", scanRes.status);
        return { wiped: 0, skipped: true, reason: `scan-${scanRes.status}` };
      }
      const scanData = await scanRes.json() as { result?: [string, string[]] };
      if (!scanData.result || !Array.isArray(scanData.result) || scanData.result.length < 2) break;
      const nextCursor = scanData.result[0];
      const batch = scanData.result[1];
      cursor = typeof nextCursor === "string" ? nextCursor : "0";
      if (Array.isArray(batch)) {
        for (const k of batch) {
          // Match excludes v2_1 (the new active cache); only legacy v2 keys
          // (without "_1_" segment) survive into the wipe list.
          if (typeof k === "string" && !k.startsWith(V2_1_KEY_PREFIX)) v2Keys.push(k);
        }
      }
    } while (cursor !== "0");

    let wipedCount = 0;
    for (const key of v2Keys) {
      try {
        const delRes = await fetch(`${env.url}/del/${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${env.token}` },
        });
        if (delRes.ok) wipedCount++;
      } catch (e) {
        console.error("Redis DEL failed for v2 key:", key, e instanceof Error ? e.message : e);
      }
    }

    await fetch(`${env.url}/set/${encodeURIComponent(V2_WIPED_FLAG_KEY)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "text/plain",
      },
      body: "1",
    });

    console.log(`[redis] V2 cache wipe complete — deleted ${wipedCount} of ${v2Keys.length} candidate key(s).`);
    return { wiped: wipedCount, skipped: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("V2 wipe failed:", msg);
    return { wiped: 0, skipped: true, reason: `error: ${msg.slice(0, 80)}` };
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
