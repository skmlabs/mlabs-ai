"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { FilterPill } from "@/components/FilterPill";
import { ExportButton } from "@/components/ExportButton";
import { DateRangePills } from "@/components/DateRangePills";
import { exportToExcel } from "@/lib/exportExcel";
import { getDateRange, isValidYMD, normalizeRangeKey, type DateRangeKey } from "@/lib/dateRange";
import { Loader2, Star, MapPin, ChevronDown, ChevronUp } from "lucide-react";

type FlatReview = {
  location_name: string;
  reviewer_name: string;
  rating: number | "";
  text: string;
  publish_time: string;
  publish_time_relative: string;
};

type GroupReview = {
  id: string;
  author_name: string | null;
  author_photo_url: string | null;
  rating: number | null;
  text: string | null;
  publish_time: string | null;
  relative_time: string | null;
};

type Group = {
  location_id: string;
  title: string;
  address: string | null;
  city: string | null;
  avg_rating: number | null;
  total_reviews: number;
  shown_reviews: number;
  distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  reviews: GroupReview[];
};

const STAR_FILTERS = [
  { label: "All", min: "", max: "" },
  { label: "5 ★", min: "5", max: "5" },
  { label: "4 ★", min: "4", max: "4" },
  { label: "3 ★", min: "3", max: "3" },
  { label: "1–2 ★", min: "1", max: "2" },
];

export default function ReviewsPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…</div>}>
      <ReviewsInner />
    </Suspense>
  );
}

function ReviewsInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const locationId = search.get("locationId");
  const minRating = search.get("minRating") ?? "";
  const maxRating = search.get("maxRating") ?? "";
  const range = normalizeRangeKey(search.get("range"));
  const customStart = search.get("start") ?? undefined;
  const customEnd = search.get("end") ?? undefined;

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (locationId) qs.set("locationId", locationId);
    if (minRating) qs.set("minRating", minRating);
    if (maxRating) qs.set("maxRating", maxRating);
    const res = await fetch(`/api/gmb/reviews-by-location?${qs.toString()}`);
    const j = await res.json() as { groups: Group[] };
    setGroups(j.groups);
    if (j.groups.length === 1) {
      const first = j.groups[0];
      if (first) setExpanded({ [first.location_id]: true });
    }
    setLoading(false);
  }, [locationId, minRating, maxRating]);
  useEffect(() => { load(); }, [load]);

  const filteredTitle = locationId ? groups.find(g => g.location_id === locationId)?.title ?? null : null;

  // Date range filtering happens client-side. With only 5 cached reviews per
  // location (Places API limit), short ranges will often return 0 — that's
  // expected, not a bug, until we get GMB v4 access for full review history.
  const dateBounds = useMemo(() => {
    const custom = range === "custom" && isValidYMD(customStart) && isValidYMD(customEnd)
      ? { start: customStart, end: customEnd } : undefined;
    const { start, end } = getDateRange(range, custom);
    const startMs = start.getTime();
    const endBoundary = new Date(end);
    endBoundary.setUTCHours(23, 59, 59, 999);
    if (endBoundary.getTime() < Date.now()) endBoundary.setTime(Date.now());
    return { startMs, endMs: endBoundary.getTime() };
  }, [range, customStart, customEnd]);

  const dateFilteredGroups = useMemo(() => {
    return groups.map(g => {
      const inRange = g.reviews.filter(r => {
        if (!r.publish_time) return true;  // keep undated reviews visible
        const t = new Date(r.publish_time).getTime();
        return t >= dateBounds.startMs && t <= dateBounds.endMs;
      });
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
      for (const r of inRange) {
        if (typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5) {
          distribution[r.rating as 1 | 2 | 3 | 4 | 5]++;
        }
      }
      return { ...g, reviews: inRange, shown_reviews: inRange.length, distribution };
    });
  }, [groups, dateBounds]);

  function setStarFilter(min: string, max: string) {
    const p = new URLSearchParams(search.toString());
    if (min) p.set("minRating", min); else p.delete("minRating");
    if (max) p.set("maxRating", max); else p.delete("maxRating");
    router.push(`${pathname}${p.toString() ? "?" + p.toString() : ""}`);
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

  function toggle(locId: string) {
    setExpanded(e => ({ ...e, [locId]: !e[locId] }));
  }

  async function onExport() {
    const flat: FlatReview[] = [];
    for (const g of dateFilteredGroups) {
      for (const r of g.reviews) {
        flat.push({
          location_name: g.title,
          reviewer_name: r.author_name ?? "Anonymous",
          rating: typeof r.rating === "number" ? r.rating : "",
          text: r.text ?? "",
          publish_time: r.publish_time ? new Date(r.publish_time).toISOString().slice(0, 10) : "",
          publish_time_relative: r.relative_time ?? "",
        });
      }
    }
    const datePart = new Date().toISOString().slice(0, 10);
    await exportToExcel(
      flat,
      [
        { key: "location_name", label: "Location" },
        { key: "rating", label: "Rating" },
        { key: "reviewer_name", label: "Author" },
        { key: "text", label: "Review" },
        { key: "publish_time", label: "Posted" },
        { key: "publish_time_relative", label: "Posted (relative)" },
      ],
      `reviews-${datePart}`,
      "Reviews",
    );
  }

  const totalReviewsShown = dateFilteredGroups.reduce((sum, g) => sum + g.reviews.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reviews</h1>
          <div className="text-xs text-muted mt-1">Grouped by location, most recent first.</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePills value={range} onChange={setRange} onCustomApply={applyCustomRange} customStart={customStart} customEnd={customEnd} />
          <div className="inline-flex bg-bg-card border border-bg-border rounded-lg p-1 text-xs">
            {STAR_FILTERS.map(f => {
              const active = (f.min === minRating) && (f.max === maxRating);
              return (
                <button key={f.label} onClick={() => setStarFilter(f.min, f.max)} className={`px-3 py-1.5 rounded-md transition ${active ? "bg-brand-indigo text-white" : "text-muted hover:text-white"}`}>
                  {f.label}
                </button>
              );
            })}
          </div>
          <ExportButton onClick={onExport} label="Export to Excel" disabled={totalReviewsShown === 0} />
        </div>
      </div>

      {filteredTitle ? <FilterPill locationTitle={filteredTitle} /> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading reviews…</div>
      ) : dateFilteredGroups.length === 0 ? (
        <div className="bg-bg-card border border-bg-border rounded-xl p-6 text-sm text-muted">
          No locations to show. Add one from Settings.
        </div>
      ) : (
        <div className="space-y-4">
          {dateFilteredGroups.map(g => {
            const isOpen = expanded[g.location_id] ?? dateFilteredGroups.length <= 2;
            const maxDist = Math.max(g.distribution[1], g.distribution[2], g.distribution[3], g.distribution[4], g.distribution[5], 1);
            // Header: "{shown} shown · {total} total on Google" — falls back to
            // "{shown} shown" when total isn't available yet (manual entries).
            const headerCount = g.total_reviews > 0
              ? `${g.shown_reviews} shown · ${g.total_reviews.toLocaleString()} total on Google`
              : `${g.shown_reviews} shown`;
            return (
              <div key={g.location_id} className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
                <button onClick={() => toggle(g.location_id)} className="w-full text-left px-4 py-3 border-b border-bg-border flex items-center justify-between hover:bg-bg transition">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <MapPin className="h-3.5 w-3.5 text-brand-indigo" />
                      <span className="font-medium">{g.title}</span>
                      {g.avg_rating != null ? <span className="inline-flex items-center gap-1 text-xs text-amber-300 ml-2"><Star className="h-3 w-3 fill-amber-300" /> {g.avg_rating.toFixed(1)}</span> : null}
                      <span className="text-xs text-muted">· {headerCount}</span>
                    </div>
                    {g.address ? <div className="text-[11px] text-muted mt-0.5 ml-5">{g.address}</div> : null}
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
                </button>

                {isOpen ? (
                  <div className="p-4 space-y-4">
                    <div className="space-y-1">
                      {([5, 4, 3, 2, 1] as const).map(star => {
                        const count = g.distribution[star];
                        const pct = (count / maxDist) * 100;
                        return (
                          <div key={star} className="flex items-center gap-2 text-xs">
                            <span className="w-4 text-muted">{star}</span>
                            <Star className="h-3 w-3 text-amber-300 fill-amber-300" />
                            <div className="flex-1 bg-bg rounded-full h-2 overflow-hidden">
                              <div className="bg-amber-400/60 h-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-10 text-right text-muted">{count}</span>
                          </div>
                        );
                      })}
                    </div>

                    {g.reviews.length === 0 ? (
                      <div className="text-xs text-muted">No reviews match the current filter.</div>
                    ) : (
                      <ul className="divide-y divide-bg-border">
                        {g.reviews.map(r => (
                          <li key={r.id} className="py-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-medium">{r.author_name ?? "Anonymous"}</div>
                              <div className="flex items-center gap-2">
                                {typeof r.rating === "number" ? <span className="text-xs flex items-center gap-0.5 text-amber-300"><Star className="h-3 w-3 fill-amber-300" /> {r.rating}</span> : null}
                                <span className="text-[11px] text-muted">
                                  {r.relative_time || (r.publish_time ? new Date(r.publish_time).toLocaleDateString() : "")}
                                </span>
                              </div>
                            </div>
                            {r.text ? <div className="text-xs text-muted mt-1 whitespace-pre-line">{r.text}</div> : <div className="text-[11px] text-muted italic mt-1">No text</div>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
