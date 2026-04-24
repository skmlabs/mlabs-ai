"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DateRangePills } from "@/components/DateRangePills";
import { FilterPill } from "@/components/FilterPill";
import { SortableHeader, type SortDir } from "@/components/SortableHeader";
import { ExportButton } from "@/components/ExportButton";
import { exportToExcel } from "@/lib/exportExcel";
import { normalizeRangeKey, type DateRangeKey } from "@/lib/dateRange";
import { Loader2, MapPin, Star } from "lucide-react";

type Row = {
  id: string;
  title: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  calls: number;
  directions: number;
  website_clicks: number;
  avg_rating: number | null;
  total_reviews: number;
  last_review_fetch: string | null;
  metrics_status: "ok" | "pending_api_access" | "never" | "error";
};

type SortKey = keyof Pick<Row, "title" | "calls" | "directions" | "website_clicks" | "avg_rating" | "total_reviews">;

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

  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<{ label: string; start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("calls");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ range });
      if (range === "custom" && customStart && customEnd) {
        qs.set("start", customStart);
        qs.set("end", customEnd);
      }
      const res = await fetch(`/api/gmb/locations-table?${qs.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json() as { rows: Row[]; range: { label: string; start: string; end: string } };
      setRows(j.rows);
      setMeta(j.range);
    } finally {
      setLoading(false);
    }
  }, [range, customStart, customEnd]);
  useEffect(() => { load(); }, [load]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Locations</h1>
          <div className="text-xs text-muted mt-1">{meta ? `${meta.label} · ${meta.start} to ${meta.end}` : ""}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePills value={range} onChange={setRange} onCustomApply={applyCustomRange} customStart={customStart} customEnd={customEnd} />
          <ExportButton onClick={onExport} label="Export to Excel" disabled={rows.length === 0} />
        </div>
      </div>

      {filteredTitle ? <FilterPill locationTitle={filteredTitle} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-bg-card border border-bg-border rounded-xl p-6 text-sm text-muted">
          No locations yet. Go to Settings to add your first location.
        </div>
      ) : (
        <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-bg">
                <tr>
                  <SortableHeader label="Location" active={sortKey === "title"} dir={sortDir} onClick={() => toggleSort("title")} />
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
                      <td className="px-4 py-3 text-right">{dash(r.calls)}</td>
                      <td className="px-4 py-3 text-right">{dash(r.directions)}</td>
                      <td className="px-4 py-3 text-right">{dash(r.website_clicks)}</td>
                      <td className="px-4 py-3 text-right">
                        {r.avg_rating != null ? <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-300 text-amber-300" /> {r.avg_rating.toFixed(1)}</span> : <span className="text-muted">—</span>}
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
