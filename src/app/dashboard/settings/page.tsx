"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Plug, Unplug, RefreshCw, MapPin, CheckCircle2, AlertCircle } from "lucide-react";

type ConnectedAccount = { id: string; google_account_email: string; google_account_name: string | null; status: string; last_synced_at: string | null; created_at: string };
type LocationRow = { id: string; title: string; address: string | null; is_active: boolean; connected_account_id: string; gmb_location_id: string };

export default function SettingsPage() {
  const search = useSearchParams();
  const connected = search.get("gmb_connected");
  const gmbError = search.get("gmb_error");

  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAccountId, setSyncingAccountId] = useState<string | null>(null);
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
    try {
      const res = await fetch(`/api/gmb/locations/sync?accountId=${encodeURIComponent(accountId)}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "sync failed");
      setBanner({ kind: "success", msg: `Synced ${j.locationsSynced} locations across ${j.accountsFound} account(s).` });
      await load();
    } catch (e) {
      setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Sync failed" });
    } finally {
      setSyncingAccountId(null);
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
              <div key={a.id} className="bg-bg-card border border-bg-border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{a.google_account_name ?? a.google_account_email}</div>
                  <div className="text-xs text-muted">{a.google_account_email}</div>
                  <div className="text-xs text-muted mt-1">Status: <span className={a.status === "active" ? "text-green-400" : "text-amber-400"}>{a.status}</span>{a.last_synced_at ? ` · Last synced ${new Date(a.last_synced_at).toLocaleString()}` : " · Never synced"}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onSync(a.id)} disabled={syncingAccountId === a.id} className="text-xs border border-bg-border hover:border-brand-indigo rounded-md px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
                    {syncingAccountId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sync locations
                  </button>
                  <button onClick={() => onDisconnect(a.id)} className="text-xs border border-red-500/30 hover:bg-red-500/10 text-red-300 rounded-md px-3 py-1.5 flex items-center gap-1.5">
                    <Unplug className="h-3.5 w-3.5" /> Disconnect
                  </button>
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
          <p className="text-sm text-muted">No locations yet. Click &quot;Sync locations&quot; above after connecting an account.</p>
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
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onToggleLocation(l.id, !l.is_active)}
                        disabled={busyLocationId === l.id}
                        className={`text-xs px-3 py-1.5 rounded-md ${l.is_active ? "bg-green-500/10 text-green-300 border border-green-500/30" : "border border-bg-border text-muted"} disabled:opacity-50`}
                      >
                        {l.is_active ? "Tracking" : "Not tracking"}
                      </button>
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
