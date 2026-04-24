"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DateRangePills } from "@/components/DateRangePills";
import { KpiCard } from "@/components/KpiCard";
import { TrendChart } from "@/components/TrendChart";
import { FilterPill } from "@/components/FilterPill";
import { normalizeRangeKey, type DateRangeKey } from "@/lib/dateRange";
import { Loader2, RefreshCw, MapPin, Star } from "lucide-react";

type OverviewResponse = {
  range: { key: DateRangeKey; label: string; start: string; end: string };
  locationFilter: string | null;
  totals: { calls: number; directions: number; website: number; totalLocations: number };
  byDate: Array<{ date: string; calls: number; directions: number; website: number }>;
  topLocations: Array<{ location_id: string; title: string; calls: number; directions: number; website: number }>;
  dataStatus: "ok" | "pending_api_access" | "never";
  reviews: { avgRating: number | null; totalReviews: number; recent: Array<{ author: string | null; rating: number | null; text: string | null; publish_time: string | null; location_title: string | null }> };
};

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default function OverviewPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading overview…</div>}>
      <OverviewInner />
    </Suspense>
  );
}

function OverviewInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const range = normalizeRangeKey(search.get("range"));
  const locationId = search.get("locationId");
  const customStart = search.get("start") ?? undefined;
  const customEnd = search.get("end") ?? undefined;

  const [data, setData] = useState<OverviewResponse | null>(null);
  const [filteredTitle, setFilteredTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<"metrics" | "reviews" | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ range });
      if (locationId) qs.set("locationId", locationId);
      if (range === "custom" && customStart && customEnd) {
        qs.set("start", customStart);
        qs.set("end", customEnd);
      }
      const res = await fetch(`/api/gmb/overview?${qs.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json() as OverviewResponse;
      setData(json);
      if (locationId && json.topLocations.length > 0) {
        const match = json.topLocations.find(t => t.location_id === locationId);
        setFilteredTitle(match?.title ?? null);
      } else {
        setFilteredTitle(null);
      }
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, [range, locationId, customStart, customEnd]);
  useEffect(() => { load(); }, [load]);

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

  async function syncMetrics() {
    setSyncing("metrics"); setBanner(null);
    try {
      const qs = new URLSearchParams({ range });
      if (range === "custom" && customStart && customEnd) {
        qs.set("start", customStart);
        qs.set("end", customEnd);
      }
      const res = await fetch(`/api/gmb/metrics/sync?${qs.toString()}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "sync failed");
      setBanner(`Metrics sync: ${j.synced} OK, ${j.pendingApiAccess} pending approval, ${j.errors} errors.`);
      await load();
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Sync failed");
    } finally { setSyncing(null); }
  }

  async function syncReviews() {
    setSyncing("reviews"); setBanner(null);
    try {
      const res = await fetch("/api/gmb/reviews/sync", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "sync failed");
      setBanner(`Reviews sync: ${j.synced} locations updated, ${j.failed} failed.`);
      await load();
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Sync failed");
    } finally { setSyncing(null); }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading overview…</div>;
  }
  if (!data) return <div className="text-red-400 text-sm">Failed to load.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <div className="text-xs text-muted mt-1">{data.range.label} · {data.range.start} to {data.range.end}</div>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePills value={range} onChange={setRange} onCustomApply={applyCustomRange} customStart={customStart} customEnd={customEnd} />
          <button onClick={syncMetrics} disabled={syncing !== null} className="text-xs border border-bg-border hover:border-brand-indigo rounded-md px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
            {syncing === "metrics" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Sync metrics
          </button>
          <button onClick={syncReviews} disabled={syncing !== null} className="text-xs border border-bg-border hover:border-brand-indigo rounded-md px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">
            {syncing === "reviews" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />} Sync reviews
          </button>
        </div>
      </div>

      {filteredTitle ? <FilterPill locationTitle={filteredTitle} /> : null}

      {banner ? <div className="bg-bg-card border border-bg-border rounded-lg px-4 py-3 text-sm text-muted">{banner}</div> : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total calls" value={fmt(data.totals.calls)} />
        <KpiCard label="Direction requests" value={fmt(data.totals.directions)} />
        <KpiCard label="Website clicks" value={fmt(data.totals.website)} />
        <KpiCard label={locationId ? "Filtered" : "Active locations"} value={data.totals.totalLocations} sub={data.reviews.avgRating != null ? `Avg rating ${data.reviews.avgRating.toFixed(1)} ★ · ${fmt(data.reviews.totalReviews)} reviews` : undefined} />
      </div>

      <TrendChart data={data.byDate} />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-bg-border text-sm font-medium">Top locations</div>
          {data.topLocations.length === 0 ? (
            <div className="p-4 text-muted text-sm">No locations yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-bg">
                <tr className="text-[11px] uppercase tracking-wider text-muted">
                  <th className="text-left px-4 py-2">Location</th>
                  <th className="text-right px-4 py-2">Calls</th>
                  <th className="text-right px-4 py-2">Directions</th>
                  <th className="text-right px-4 py-2">Website</th>
                </tr>
              </thead>
              <tbody>
                {data.topLocations.map(t => (
                  <tr
                    key={t.location_id}
                    className="border-t border-bg-border hover:bg-bg cursor-pointer"
                    onClick={() => {
                      const p = new URLSearchParams(search.toString());
                      p.set("locationId", t.location_id);
                      router.push(`${pathname}?${p.toString()}`);
                    }}
                  >
                    <td className="px-4 py-2 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-brand-indigo" /> {t.title}</td>
                    <td className="px-4 py-2 text-right">{fmt(t.calls)}</td>
                    <td className="px-4 py-2 text-right">{fmt(t.directions)}</td>
                    <td className="px-4 py-2 text-right">{fmt(t.website)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-bg-border text-sm font-medium">Recent reviews</div>
          {data.reviews.recent.length === 0 ? (
            <div className="p-4 text-muted text-sm">No reviews yet. Click &quot;Sync reviews&quot; above.</div>
          ) : (
            <ul className="divide-y divide-bg-border">
              {data.reviews.recent.map((r, i) => (
                <li key={i} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium">{r.author ?? "Anonymous"}{r.location_title ? <span className="text-muted"> · {r.location_title}</span> : null}</div>
                    {typeof r.rating === "number" ? <div className="text-xs flex items-center gap-0.5 text-amber-300"><Star className="h-3 w-3 fill-amber-300" /> {r.rating}</div> : null}
                  </div>
                  {r.text ? <div className="text-xs text-muted mt-1 line-clamp-3">{r.text}</div> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-bg-border text-sm font-medium">Daily breakdown</div>
        {data.byDate.length === 0 ? (
          <div className="p-4 text-muted text-sm">No daily data for this range.</div>
        ) : (
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-bg sticky top-0">
                <tr className="text-[11px] uppercase tracking-wider text-muted">
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-right px-4 py-2">Calls</th>
                  <th className="text-right px-4 py-2">Directions</th>
                  <th className="text-right px-4 py-2">Website</th>
                </tr>
              </thead>
              <tbody>
                {data.byDate.map(d => (
                  <tr key={d.date} className="border-t border-bg-border">
                    <td className="px-4 py-2">{d.date}</td>
                    <td className="px-4 py-2 text-right">{fmt(d.calls)}</td>
                    <td className="px-4 py-2 text-right">{fmt(d.directions)}</td>
                    <td className="px-4 py-2 text-right">{fmt(d.website)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
