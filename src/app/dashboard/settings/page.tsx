"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plug, Unplug, RefreshCw, MapPin, CheckCircle2, AlertCircle } from "lucide-react";

type ConnectedAccount = { id: string; google_account_email: string; google_account_name: string | null; status: string; last_synced_at: string | null; created_at: string };
type LocationRow = { id: string; title: string; address: string | null; is_active: boolean; connected_account_id: string; gmb_location_id: string };
type SyncProgress = { total: number; completed: number; status: "running" | "complete" | "failed" | "idle"; startedAt?: number; completedAt?: number };

export default function SettingsPage() {
  const search = useSearchParams();
  const connected = search.get("gmb_connected");
  const gmbError = search.get("gmb_error");

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [busyLocationId, setBusyLocationId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; msg: string } | null>(
    connected ? { kind: "success", msg: "Google Business Profile connected." }
      : gmbError ? { kind: "error", msg: `Connection failed: ${gmbError}` } : null
  );

  const load = useCallback(async () => {
    setLoading(true);
    const [sRes, lRes] = await Promise.all([fetch("/api/gmb/status"), fetch("/api/gmb/locations")]);
    const s = await sRes.json();
    const l = await lRes.json();
    setAccounts(s.accounts ?? []);
    setLocations(l.locations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onSync(accountId: string) {
    setSyncingAccountId(accountId);
    setSyncProgress({ total: 0, completed: 0, status: "running" });

    // Poll for visible progress while the actual sync request is in flight.
    // Awaiting the sync response is still the source of truth for "done";
    // the poller only updates the visible counter. If REDIS_URL/REDIS_TOKEN
    // aren't set, the poll returns { status: "idle" } and the user sees the
    // generic "Auto-syncing…" state — graceful degradation.
    const pollInterval = window.setInterval(async () => {
      try {
        const res = await fetch("/api/gmb/sync-progress", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json() as SyncProgress;
        if (j.status === "running" || j.status === "complete") setSyncProgress(j);
      } catch { /* ignore — best-effort poll */ }
    }, 1000);

    try {
      const res = await fetch(`/api/gmb/locations/sync?accountId=${encodeURIComponent(accountId)}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "sync failed");
      setBanner({ kind: "success", msg: `Synced ${j.locationsSynced} locations across ${j.accountsFound} account(s).` });
      await load();
    } catch (e) {
      setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Sync failed" });
    } finally {
      window.clearInterval(pollInterval);
      setSyncingAccountId(null);
      // Brief settle: keep "✓ Synced N locations" visible for 2s before clearing
      // so the user registers the completion state.
      window.setTimeout(() => setSyncProgress(null), 2000);
    }
  }

  async function onDisconnect(accountId: string) {
    if (!confirm("Disconnect this Google account? All its locations will also be removed.")) return;
    const res = await fetch(`/api/gmb/disconnect?accountId=${encodeURIComponent(accountId)}`, { method: "POST" });
    if (res.ok) { setBanner({ kind: "success", msg: "Disconnected." }); await load(); }
    else setBanner({ kind: "error", msg: "Failed to disconnect." });
  }

  async function onToggleLocation(locationId: string, next: boolean) {
    setBusyLocationId(locationId);
    const res = await fetch("/api/gmb/locations/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId, isActive: next }),
    });
    if (res.ok) setLocations(prev => prev.map(l => l.id === locationId ? { ...l, is_active: next } : l));
    setBusyLocationId(null);
  }

  async function onDeleteLocation(locationId: string, title: string) {
    if (!confirm(`Remove "${title}"? This also removes cached metrics and reviews.`)) return;
    const res = await fetch("/api/gmb/locations/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId }),
    });
    if (res.ok) { setBanner({ kind: "success", msg: "Location removed." }); await load(); }
    else setBanner({ kind: "error", msg: "Failed to remove." });
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold">Settings</h1>
      <p className="text-muted mt-1 text-sm">Connect your Google Business Profile and choose which locations to track.</p>

      {banner ? (
        <div className={`mt-4 rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${banner.kind === "success" ? "bg-green-500/10 text-green-300 border border-green-500/20" : "bg-red-500/10 text-red-300 border border-red-500/20"}`}>
          {banner.kind === "success" ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
          <span>{banner.msg}</span>
          <button className="ml-auto text-xs text-muted hover:text-white" onClick={() => setBanner(null)}>Dismiss</button>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold mb-3">Connected accounts</h2>
        {loading ? (
          <div className="text-muted text-sm flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : accounts.length === 0 ? (
          <div className="bg-bg-card border border-bg-border rounded-xl p-6 text-center">
            <Plug className="h-8 w-8 mx-auto text-brand-indigo mb-3" />
            <p className="text-sm text-muted mb-4">No Google Business Profile connected yet.</p>
            <a href="/api/gmb/connect" className="inline-block bg-brand-indigo hover:bg-indigo-600 px-4 py-2 rounded-lg text-sm font-medium text-white">
              Connect Google Business Profile
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map(a => (
              <div key={a.id} className="bg-bg-card border border-bg-border rounded-xl p-4 flex items-start justify-between">
                <div>
                  <div className="text-sm font-medium">{a.google_account_name ?? a.google_account_email}</div>
                  <div className="text-xs text-muted">{a.google_account_email}</div>
                  <div className="text-xs text-muted mt-1">Status: <span className={a.status === "active" ? "text-green-400" : "text-amber-400"}>{a.status}</span>{a.last_synced_at ? ` · Last synced ${new Date(a.last_synced_at).toLocaleString()}` : " · Never synced"}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex gap-2">
                    <button onClick={() => onSync(a.id)} disabled={syncingAccountId === a.id} className="text-xs border border-bg-border hover:border-brand-indigo rounded-md px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
                      {syncingAccountId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Auto-sync
                    </button>
                    <button onClick={() => onDisconnect(a.id)} className="text-xs border border-red-500/30 hover:bg-red-500/10 text-red-300 rounded-md px-3 py-1.5 flex items-center gap-1.5">
                      <Unplug className="h-3.5 w-3.5" /> Disconnect
                    </button>
                  </div>
                  {/* Visible progress counter — shown only while THIS account is the active sync. */}
                  {syncingAccountId === a.id && syncProgress ? (
                    <div className="text-[11px] text-brand-indigo bg-brand-indigo/10 border border-brand-indigo/30 rounded px-2 py-1">
                      {syncProgress.status === "complete"
                        ? `✓ Synced ${syncProgress.total} location${syncProgress.total === 1 ? "" : "s"}`
                        : syncProgress.total > 0
                          ? `Synced ${syncProgress.completed} of ${syncProgress.total} locations…`
                          : "Auto-syncing…"}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <a href="/api/gmb/connect" className="text-xs text-brand-indigo hover:underline">+ Connect another Google account</a>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold mb-3">Your locations</h2>
        {loading ? null : locations.length === 0 ? (
          <p className="text-sm text-muted">No locations yet. Click &quot;Auto-sync&quot; above after connecting an account.</p>
        ) : (
          <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-bg border-b border-bg-border">
                <tr className="text-xs uppercase tracking-wider text-muted">
                  <th className="text-left px-4 py-3">Business</th>
                  <th className="text-left px-4 py-3">Address</th>
                  <th className="text-right px-4 py-3">Tracking</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(l => (
                  <tr key={l.id} className="border-t border-bg-border">
                    <td className="px-4 py-3 flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-brand-indigo" /> {l.title}</td>
                    <td className="px-4 py-3 text-muted text-xs">{l.address ?? "—"}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button onClick={() => onToggleLocation(l.id, !l.is_active)} disabled={busyLocationId === l.id} className={`text-xs px-3 py-1.5 rounded-md ${l.is_active ? "bg-green-500/10 text-green-300 border border-green-500/30" : "border border-bg-border text-muted"} disabled:opacity-50`}>
                        {l.is_active ? "Tracking" : "Not tracking"}
                      </button>
                      <button onClick={() => onDeleteLocation(l.id, l.title)} className="text-xs px-3 py-1.5 rounded-md border border-red-500/30 text-red-300 hover:bg-red-500/10">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
