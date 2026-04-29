// Resolve Upstash REST credentials with multi-name fallback + format
// validation. The pre-fix `envPair()` only checked REDIS_URL/REDIS_TOKEN and
// silently failed when those held the redis:// protocol URL (which fetch
// can't speak). This helper:
//
// 1. Accepts three env var conventions (in priority order):
//    REDIS_URL/REDIS_TOKEN              ← internal convention
//    UPSTASH_REDIS_REST_URL/_TOKEN      ← Upstash's own naming
//    KV_REST_API_URL/_TOKEN             ← Vercel KV
//
// 2. Validates the URL is https:// — Upstash's REST endpoint. If a candidate
//    is a redis:// protocol URL it's logged loudly and skipped, so the next
//    candidate gets a chance.
//
// 3. Returns null if nothing usable is configured. Callers fall back to
//    graceful no-op (cache miss / no progress).

interface RedisRest {
  url: string;
  token: string;
  source: string;  // for diagnostics
}

interface Candidate {
  url: string | undefined;
  token: string | undefined;
  source: string;
}

function candidates(): Candidate[] {
  return [
    { url: process.env.REDIS_URL, token: process.env.REDIS_TOKEN, source: "REDIS_URL/REDIS_TOKEN" },
    { url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN, source: "UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN" },
    { url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN, source: "KV_REST_API_URL/KV_REST_API_TOKEN" },
  ];
}

export function resolveRedisRest(): RedisRest | null {
  for (const c of candidates()) {
    if (!c.url || !c.token) continue;
    const trimmed = c.url.trim().replace(/\/+$/, "");
    if (!/^https:\/\//i.test(trimmed)) {
      // Loud warning so this surfaces in Vercel runtime logs. Most common cause:
      // operator pasted the redis:// protocol URL from Upstash's "Redis" tab
      // instead of the REST URL from the "REST API" tab.
      console.warn(
        `[redis] ${c.source}: value is not an https:// URL — skipping. ` +
        `Got prefix "${trimmed.slice(0, 12)}…". Upstash REST URL must start with https://.`,
      );
      continue;
    }
    return { url: trimmed, token: c.token, source: c.source };
  }
  return null;
}

// Live ping — used by the diagnostic endpoint to confirm credentials actually
// authenticate. Reads a non-existent key; success = HTTP 200 with null result.
// Failure modes: 401 (bad token), DNS failure (bad URL), etc.
export async function pingRedisRest(): Promise<{ ok: boolean; source: string | null; error?: string; status?: number }> {
  const env = resolveRedisRest();
  if (!env) return { ok: false, source: null, error: "No usable env var pair found." };

  try {
    const probe = await fetch(`${env.url}/get/__mlabs_redis_probe__`, {
      headers: { Authorization: `Bearer ${env.token}` },
      cache: "no-store",
    });
    if (!probe.ok) {
      const body = await probe.text().catch(() => "");
      return { ok: false, source: env.source, status: probe.status, error: body.slice(0, 200) };
    }
    return { ok: true, source: env.source, status: probe.status };
  } catch (e) {
    return { ok: false, source: env.source, error: e instanceof Error ? e.message : String(e) };
  }
}

// Diagnostic: which Redis-shaped env var names are visible in the runtime,
// and (for those that are) what URL protocol prefix do they have. Returns
// names + format only — never the values themselves.
export interface RedisEnvDiagnostic {
  redisLikeKeys: string[];
  candidates: Array<{
    source: string;
    urlPresent: boolean;
    tokenPresent: boolean;
    urlFormat: "https" | "redis" | "other" | null;
  }>;
}

function urlFormat(url: string | undefined): "https" | "redis" | "other" | null {
  if (!url) return null;
  const t = url.trim();
  if (/^https:\/\//i.test(t)) return "https";
  if (/^redis:\/\//i.test(t)) return "redis";
  return "other";
}

export function diagnoseRedisEnv(): RedisEnvDiagnostic {
  const redisLikeKeys = Object.keys(process.env)
    .filter(k => /redis|upstash|^kv_/i.test(k))
    .sort();

  const pairs: Array<{ source: string; urlVar: string; tokenVar: string }> = [
    { source: "REDIS_URL/REDIS_TOKEN", urlVar: "REDIS_URL", tokenVar: "REDIS_TOKEN" },
    { source: "UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN", urlVar: "UPSTASH_REDIS_REST_URL", tokenVar: "UPSTASH_REDIS_REST_TOKEN" },
    { source: "KV_REST_API_URL/KV_REST_API_TOKEN", urlVar: "KV_REST_API_URL", tokenVar: "KV_REST_API_TOKEN" },
  ];

  const candidates = pairs.map(p => ({
    source: p.source,
    urlPresent: typeof process.env[p.urlVar] === "string" && process.env[p.urlVar]!.length > 0,
    tokenPresent: typeof process.env[p.tokenVar] === "string" && process.env[p.tokenVar]!.length > 0,
    urlFormat: urlFormat(process.env[p.urlVar]),
  }));

  return { redisLikeKeys, candidates };
}
