// Per-user sync progress in Upstash Redis. Same fetch-based pattern as
// src/lib/ai/insightsCache.ts so we don't add a new dependency. Gracefully
// no-ops when REDIS_URL/REDIS_TOKEN are missing — the UI's polling endpoint
// returns { status: "idle" } in that case and the page falls back to its
// awaited spinner.
//
// Single key per user (last writer wins). Today the only writer is
// syncOwnedLocationsForUser (Places sync); reviews/metrics syncs run in
// parallel but don't touch this key. Good enough as a visible-progress proxy
// for the most parallelizable phase.

const RUNNING_TTL_SECONDS = 600;   // 10-min safety in case the route crashes
const COMPLETE_TTL_SECONDS = 60;   // tail TTL — UI polls a few times after done

export type SyncProgressStatus = "running" | "complete" | "failed";

export interface SyncProgress {
  total: number;
  completed: number;
  status: SyncProgressStatus;
  startedAt: number;
  completedAt?: number;
  error?: string;
}

function progressKey(userId: string): string {
  return `mlabs_sync_progress_${userId}`;
}

function envPair(): { url: string; token: string } | null {
  const url = process.env.REDIS_URL;
  const token = process.env.REDIS_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

export async function getSyncProgress(userId: string): Promise<SyncProgress | null> {
  const env = envPair();
  if (!env) return null;

  const key = progressKey(userId);
  try {
    const res = await fetch(`${env.url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${env.token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json() as { result?: string | null };
    if (typeof data.result !== "string") return null;
    return JSON.parse(data.result) as SyncProgress;
  } catch (e) {
    console.error("Redis get progress failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function setSyncProgress(userId: string, progress: SyncProgress): Promise<void> {
  const env = envPair();
  if (!env) return;

  const key = progressKey(userId);
  const ttl = progress.status === "running" ? RUNNING_TTL_SECONDS : COMPLETE_TTL_SECONDS;
  try {
    const res = await fetch(`${env.url}/set/${encodeURIComponent(key)}?EX=${ttl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "text/plain",
      },
      body: JSON.stringify(progress),
    });
    if (!res.ok) {
      console.error("Redis set progress failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("Redis set progress failed:", e instanceof Error ? e.message : e);
  }
}

export async function clearSyncProgress(userId: string): Promise<void> {
  const env = envPair();
  if (!env) return;
  const key = progressKey(userId);
  try {
    await fetch(`${env.url}/del/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}` },
    });
  } catch (e) {
    console.error("Redis del progress failed:", e instanceof Error ? e.message : e);
  }
}
