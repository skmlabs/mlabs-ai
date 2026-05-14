"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DateRangePills } from "@/components/DateRangePills";
import { FilterPill } from "@/components/FilterPill";
import { SortableHeader, type SortDir } from "@/components/SortableHeader";
import { ExportButton } from "@/components/ExportButton";
import { exportToExcel } from "@/lib/exportExcel";
import { normalizeRangeKey, type DateRangeKey } from "@/lib/dateRange";
import { timeAgo } from "@/lib/timeAgo";
import { OnboardingGate } from "@/components/OnboardingGate";
import { AlertTriangle, CheckCircle2, Loader2, MapPin, RefreshCw, Star } from "lucide-react";

type SyncProgress = {
  status: "idle" | "running" | "complete" | "failed";
  total?: number;
  completed?: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
};

type Row = {
  id: string;
  title: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  calls: number;
  directions: number;
  website_clicks: number;
  avg_rating: number | null;
  total_reviews: number;
  places_sync_status: string | null;
  metrics_status: "ok" | "pending_api_access" | "never" | "error";
};

type SortKey = keyof Pick<Row, "title" | "city" | "calls" | "directions" | "website_clicks" | "avg_rating" | "total_reviews">;

interface LocationsResponse {
  rows: Row[];
  range: { label: string; start: string; end: string };
  places?: { total: number; failed: number };
}

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function LocationsPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}>
      <LocationsInner />
    </Suspense>
  );
}

function LocationsInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const range = normalizeRangeKey(search.get("range"));
  const locationId = search.get("locationId");
  const customStart = search.get("start") ?? undefined;
  const customEnd = search.get("end") ?? undefined;
  const justConnected = search.get("just_connected") === "1";

  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{ label: string; start: string; end: string } | null>(null);
  const [placesMeta, setPlacesMeta] = useState<{ total: number; failed: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("calls");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncBanner, setSyncBanner] = useState<string | null>(null);
  // Post-OAuth (or any in-flight server-side sync): poll progress + re-fetch the
  // table so locations stream into the grid as syncOwnedLocationsForUser writes
  // them. `justCompleted` keeps the "Sync complete" pill visible briefly before
  // we drop the banner entirely.
  const [progress, setProgress] = useState<SyncProgress | null>(justConnected ? { status: "running", total: 0, completed: 0 } : null);
  const [justCompleted, setJustCompleted] = useState(false);

  // `silent: true` skips the top-level spinner so the polling effect can
  // re-fetch the grid every 2s without flashing the "Loading…" state.
  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const qs = new URLSearchParams({ range });
      if (range === "custom" && customStart && customEnd) {
        qs.set("start", customStart);
        qs.set("end", customEnd);
      }
      const res = await fetch(`/api/gmb/locations-table?${qs.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json() as LocationsResponse;
      setRows(j.rows);
      setMeta(j.range);
      setPlacesMeta(j.places ?? null);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [range, customStart, customEnd]);
  useEffect(() => { load(); }, [load]);

  const loadSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync-status");
      if (res.ok) {
        const j = await res.json() as { last_synced_at: string | null };
        setLastSyncedAt(j.last_synced_at);
      }
    } catch { /* non-blocking */ }
  }, []);
  useEffect(() => { loadSyncStatus(); }, [loadSyncStatus]);

  // Post-OAuth: poll /api/gmb/sync-progress every 2s and silently re-fetch the
  // locations grid between polls so rows stream in as the server-side
  // runFullSyncForAccount writes them. Stops on `complete` or `failed`, settles
  // for 2.5s to show the success pill, then strips `just_connected` from the
  // URL so a reload doesn't re-trigger the polling loop.
  useEffect(() => {
    if (!justConnected) return;
    let cancelled = false;
    let intervalId: number | null = null;

    const stop = () => {
      if (intervalId != null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const tick = async () => {
      if (cancelled) return;
      let snap: SyncProgress | null = null;
      try {
        const res = await fetch("/api/gmb/sync-progress", { cache: "no-store" });
        if (res.ok) snap = await res.json() as SyncProgress;
      } catch { /* swallow — best-effort poll */ }
      if (cancelled) return;
      if (snap) setProgress(snap);
      await load({ silent: true });
      await loadSyncStatus();
      if (cancelled) return;
      if (snap && (snap.status === "complete" || snap.status === "failed")) {
        stop();
        setJustCompleted(snap.status === "complete");
        window.setTimeout(() => {
          if (cancelled) return;
          setJustCompleted(false);
          setProgress(null);
          const p = new URLSearchParams(search.toString());
          p.delete("just_connected");
          router.replace(`${pathname}${p.toString() ? "?" + p.toString() : ""}`);
        }, 2500);
      }
    };

    tick();
    intervalId = window.setInterval(tick, 2000);

    return () => {
      cancelled = true;
      stop();
    };
    // We want this effect to fire once when justConnected flips true. `load`
    // and `loadSyncStatus` are stable useCallbacks and `search`/`pathname`/
    // `router` don't meaningfully change during this loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justConnected]);

  async function syncNow() {
    setSyncing(true); setSyncBanner(null);
    try {
      const qs = new URLSearchParams({ range });
      if (range === "custom" && customStart && customEnd) { qs.set("start", customStart); qs.set("end", customEnd); }
      const res = await fetch(`/api/gmb/sync-now?${qs.toString()}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "sync failed");
      setSyncBanner(`Synced. Reviews: ${j.reviews.total_fetched} across ${j.reviews.locations} location(s).`);
      await Promise.all([load(), loadSyncStatus()]);
    } catch (e) {
      setSyncBanner(e instanceof Error ? e.message : "Sync failed");
    } finally { setSyncing(false); }
  }

  const sortedRows = useMemo(() => {
    const r = [...rows];
    r.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return r;
  }, [rows, sortKey, sortDir]);

  const filteredTitle = locationId ? rows.find(r => r.id === locationId)?.title ?? null : null;
  const visibleRows = locationId ? sortedRows.filter(r => r.id === locationId) : sortedRows;

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  function setRange(k: DateRangeKey) {
    const p = new URLSearchParams(search.toString());
    p.set("range", k);
    if (k !== "custom") { p.delete("start"); p.delete("end"); }
    router.push(`${pathname}?${p.toString()}`);
  }

  function applyCustomRange(start: string, end: string) {
    const p = new URLSearchParams(search.toString());
    p.set("range", "custom");
    p.set("start", start);
    p.set("end", end);
    router.push(`${pathname}?${p.toString()}`);
  }

  function onRowClick(locId: string) {
    const p = new URLSearchParams(search.toString());
    if (p.get("locationId") === locId) p.delete("locationId"); else p.set("locationId", locId);
    router.push(`${pathname}${p.toString() ? "?" + p.toString() : ""}`);
  }

  async function onExport() {
    const datePart = meta ? `${meta.start}-to-${meta.end}` : new Date().toISOString().slice(0, 10);
    await exportToExcel(
      visibleRows,
      [
        { key: "title", label: "Location" },
        { key: "city", label: "City", format: v => typeof v === "string" ? v : "" },
        { key: "address", label: "Address", format: v => typeof v === "string" ? v : "" },
        { key: "phone", label: "Phone", format: v => typeof v === "string" ? v : "" },
        { key: "website", label: "Website", format: v => typeof v === "string" ? v : "" },
        { key: "calls", label: "Calls" },
        { key: "directions", label: "Directions" },
        { key: "website_clicks", label: "Website Clicks" },
        { key: "avg_rating", label: "Avg Rating", format: v => typeof v === "number" ? v.toFixed(1) : "-" },
        { key: "total_reviews", label: "Total Reviews" },
        { key: "metrics_status", label: "Metrics Status", format: v => typeof v === "string" ? v : "" },
      ],
      `my-locations-${datePart}`,
      "My Locations",
    );
  }

  const isSyncing = justConnected || progress?.status === "running" || justCompleted;
  // No GMB-synced locations yet → onboarding takes over the whole page. But if
  // a fresh OAuth-triggered sync is in flight, keep the page chrome so the
  // sticky "Syncing locations…" banner can show + rows can stream in.
  if (!loading && rows.length === 0 && !isSyncing) return <OnboardingGate />;

  return (
    <div className="space-y-6">
      {isSyncing ? (
        <div className="sticky top-0 z-10 bg-brand-indigo/10 border border-brand-indigo/30 text-brand-indigo rounded-lg px-4 py-3 text-sm flex items-center gap-2">
          {justCompleted || progress?.status === "complete" ? (
            <>
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Sync complete — {progress?.total ?? rows.length} location{(progress?.total ?? rows.length) === 1 ? "" : "s"} ready.</span>
            </>
          ) : (
            <>
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              <span>
                {progress && (progress.total ?? 0) > 0
                  ? `Syncing locations… (${progress.completed ?? 0} of ${progress.total})`
                  : "Syncing locations…"}
              </span>
            </>
          )}
        </div>
      ) : null}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Locations</h1>
          <div className="text-xs text-muted mt-1 flex items-center gap-3 flex-wrap">
            <span>{meta ? `${meta.label} · ${meta.start} to ${meta.end}` : ""}</span>
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              <span>Last synced {timeAgo(lastSyncedAt)}</span>
              <button onClick={syncNow} disabled={syncing} className="text-brand-indigo hover:underline disabled:opacity-50 ml-1">
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePills value={range} onChange={setRange} onCustomApply={applyCustomRange} customStart={customStart} customEnd={customEnd} />
          <ExportButton onClick={onExport} label="Export to Excel" disabled={rows.length === 0} />
        </div>
      </div>

      {syncBanner ? <div className="bg-bg-card border border-bg-border rounded-lg px-4 py-2.5 text-sm text-muted">{syncBanner}</div> : null}

      {/* Subtle warning if any location's Places sync failed. Updated counts come from the daily cron. */}
      {placesMeta && placesMeta.failed > 0 ? (
        <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 text-amber-200 rounded-lg px-4 py-2.5 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Some location data sync failed. {placesMeta.total - placesMeta.failed} of {placesMeta.total} locations updated. Try syncing again or contact support.</span>
        </div>
      ) : null}

      {filteredTitle ? <FilterPill locationTitle={filteredTitle} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        isSyncing ? (
          <div className="bg-bg-card border border-bg-border rounded-xl p-6 text-sm text-muted">
            Hang tight — we&apos;re pulling your locations from Google. They&apos;ll appear here as they sync.
          </div>
        ) : (
          <div className="bg-bg-card border border-bg-border rounded-xl p-6 text-sm text-muted">
            No locations yet. Go to Settings to add your first location.
          </div>
        )
      ) : (
        <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead className="bg-bg">
                <tr>
                  <SortableHeader label="Location" active={sortKey === "title"} dir={sortDir} onClick={() => toggleSort("title")} />
                  <SortableHeader label="City" active={sortKey === "city"} dir={sortDir} onClick={() => toggleSort("city")} />
                  <SortableHeader label="Calls" align="right" active={sortKey === "calls"} dir={sortDir} onClick={() => toggleSort("calls")} />
                  <SortableHeader label="Directions" align="right" active={sortKey === "directions"} dir={sortDir} onClick={() => toggleSort("directions")} />
                  <SortableHeader label="Website" align="right" active={sortKey === "website_clicks"} dir={sortDir} onClick={() => toggleSort("website_clicks")} />
                  <SortableHeader label="Avg rating" align="right" active={sortKey === "avg_rating"} dir={sortDir} onClick={() => toggleSort("avg_rating")} />
                  <SortableHeader label="Total reviews" align="right" active={sortKey === "total_reviews"} dir={sortDir} onClick={() => toggleSort("total_reviews")} />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(r => {
                  const selected = locationId === r.id;
                  const pendingMetrics = r.metrics_status === "pending_api_access" || r.metrics_status === "never";
                  const dash = (n: number) => pendingMetrics ? "—" : fmt(n);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => onRowClick(r.id)}
                      className={`border-t border-bg-border cursor-pointer transition ${selected ? "bg-brand-indigo/10" : "hover:bg-bg"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-brand-indigo" /> <span className="font-medium">{r.title}</span></div>
                        {r.address ? <div className="text-[11px] text-muted mt-0.5 ml-5">{r.address}</div> : null}
                      </td>
                      <td className="px-4 py-3 text-muted">{r.city ?? <span className="text-muted/60">—</span>}</td>
                      <td className="px-4 py-3 text-right">{dash(r.calls)}</td>
                      <td className="px-4 py-3 text-right">{dash(r.directions)}</td>
                      <td className="px-4 py-3 text-right">{dash(r.website_clicks)}</td>
                      <td className="px-4 py-3 text-right">
                        {r.avg_rating != null
                          ? <span className="inline-flex items-center gap-1 text-amber-300"><Star className="h-3 w-3 fill-amber-300 text-amber-300" /> {r.avg_rating.toFixed(1)}</span>
                          : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{r.total_reviews > 0 ? fmt(r.total_reviews) : <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-[11px] text-muted">Click a row to filter Overview, Locations, and Reviews to that location.</p>
    </div>
  );
}
