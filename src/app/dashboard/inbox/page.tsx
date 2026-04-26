"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Loader2, Star, MapPin, Image as ImageIcon, ArrowLeft, ExternalLink, X } from "lucide-react";

type SortKey = "newest" | "oldest" | "lowest_rating";

interface InboxReview {
  id: string;
  location_id: string;
  location_title: string | null;
  author_name: string | null;
  author_photo_url: string | null;
  rating: number | null;
  text: string | null;
  publish_time: string | null;
  relative_time: string | null;
  reply_on_google_url: string | null;
}

interface InboxResponse {
  reviews: InboxReview[];
  metrics: {
    total_in_range: number;
    responded_in_range: number;
    unresponded_in_range: number;
    responded_pct: number;
    avg_tat_seconds: number | null;
    median_tat_seconds: number | null;
  };
  locations: { id: string; title: string }[];
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading inbox…</div>}>
      <InboxInner />
    </Suspense>
  );
}

function InboxInner() {
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ratingsFromUrl = (search.get("rating") ?? "").split(",").map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 5);
  const sortFromUrl = (search.get("sort") as SortKey | null) ?? "newest";
  const locationFilter = search.get("location_id");
  const selectedFromUrl = search.get("review");

  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(selectedFromUrl);
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (ratingsFromUrl.length > 0) qs.set("rating", ratingsFromUrl.join(","));
      if (sortFromUrl !== "newest") qs.set("sort", sortFromUrl);
      if (locationFilter) qs.set("location_id", locationFilter);
      const res = await fetch(`/api/reviews/inbox?${qs.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json() as InboxResponse;
      setData(json);
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  // ratingsFromUrl is recomputed from search every render — depend on the raw string.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.get("rating"), sortFromUrl, locationFilter]);

  useEffect(() => { load(); }, [load]);

  // Keep selection valid; if URL has a stale id, clear it
  useEffect(() => {
    if (!data) return;
    if (selectedId && !data.reviews.find(r => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [data, selectedId]);

  const selected = useMemo(
    () => data?.reviews.find(r => r.id === selectedId) ?? null,
    [data, selectedId],
  );

  function updateUrl(updater: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(search.toString());
    updater(p);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function toggleRating(n: number) {
    const next = ratingsFromUrl.includes(n) ? ratingsFromUrl.filter(x => x !== n) : [...ratingsFromUrl, n].sort();
    updateUrl(p => {
      if (next.length === 0) p.delete("rating");
      else p.set("rating", next.join(","));
    });
  }

  function setSort(s: SortKey) {
    updateUrl(p => {
      if (s === "newest") p.delete("sort");
      else p.set("sort", s);
    });
  }

  function setLocationDropdown(v: string) {
    updateUrl(p => {
      if (v === "") p.delete("location_id");
      else p.set("location_id", v);
    });
  }

  function selectReview(id: string | null) {
    setSelectedId(id);
    updateUrl(p => {
      if (id) p.set("review", id); else p.delete("review");
    });
  }

  const reviews = data?.reviews ?? [];
  const locations = data?.locations ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reviews Inbox</h1>
          <div className="text-xs text-muted mt-1">
            Up to 5 most recent reviews per location, pulled from Google.
          </div>
        </div>
      </div>

      {banner ? (
        <div className="bg-bg-card border border-bg-border rounded-lg px-4 py-2.5 text-sm text-muted flex items-start gap-2">
          <span className="flex-1">{banner}</span>
          <button onClick={() => setBanner(null)} className="text-xs text-muted hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      {/* KPI cards hidden — reply data not available via Places API.
          Restore when GMB API access propagates.
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ReputationCard label="Avg first response" value={formatTatSeconds(metrics?.avg_tat_seconds ?? null)} accent="indigo" />
        <ReputationCard label="% Responded" value={metrics ? `${metrics.responded_pct}%` : "—"} accent="emerald" />
        <ReputationCard label="Need reply" value={metrics ? String(metrics.unresponded_in_range) : "—"} accent={metrics && metrics.unresponded_in_range > 0 ? "amber" : "neutral"} />
        <ReputationCard label="Median TAT" value={formatTatSeconds(metrics?.median_tat_seconds ?? null)} accent="indigo" />
      </div>
      */}

      {/* 3-column on desktop, single-pane on mobile (selection toggles to detail) */}
      <div className="grid md:grid-cols-[220px_minmax(0,360px)_minmax(0,1fr)] gap-4">
        {/* Filter sidebar — hidden on mobile when a review is selected */}
        <aside className={`bg-bg-card border border-bg-border rounded-xl p-4 space-y-5 ${selected ? "hidden md:block" : ""}`}>
          {/* Status filter hidden — reply data not available via Places API.
              Restore when GMB API access propagates.
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Status</div>
            <div className="flex flex-col gap-1">
              {(["all", "unresponded", "responded"] as StatusFilter[]).map(s => (
                <label key={s} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" name="status" checked={statusFromUrl === s} onChange={() => setStatus(s)} className="accent-brand-indigo" />
                  <span className="capitalize">{s === "all" ? "All" : s}</span>
                </label>
              ))}
            </div>
          </div>
          */}

          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Rating</div>
            <div className="flex flex-col gap-1">
              {[5, 4, 3, 2, 1].map(n => (
                <label key={n} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={ratingsFromUrl.includes(n)} onChange={() => toggleRating(n)} className="accent-brand-indigo" />
                  <span className="flex items-center gap-1">{n} <Star className="h-3 w-3 fill-amber-300 text-amber-300" /></span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Location</div>
            <select value={locationFilter ?? ""} onChange={e => setLocationDropdown(e.target.value)} className="w-full bg-bg border border-bg-border rounded-md px-2 py-1.5 text-xs">
              <option value="">All locations</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted mb-2">Sort</div>
            <div className="flex flex-col gap-1">
              {([
                { k: "newest", label: "Newest" },
                { k: "oldest", label: "Oldest" },
                { k: "lowest_rating", label: "Lowest rating" },
              ] as { k: SortKey; label: string }[]).map(o => (
                <label key={o.k} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="radio" name="sort" checked={sortFromUrl === o.k} onChange={() => setSort(o.k)} className="accent-brand-indigo" />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Review list — hidden on mobile when a review is selected */}
        <div className={`bg-bg-card border border-bg-border rounded-xl overflow-hidden flex flex-col ${selected ? "hidden md:flex" : "flex"}`}>
          <div className="px-4 py-2.5 border-b border-bg-border text-xs text-muted flex items-center justify-between">
            <span>{reviews.length} reviews</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-muted flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : reviews.length === 0 ? (
            <div className="p-6 text-sm text-muted">No reviews match your filters.</div>
          ) : (
            <ul className="flex-1 overflow-y-auto max-h-[640px] divide-y divide-bg-border">
              {reviews.map(r => {
                const isSelected = r.id === selectedId;
                const snippet = r.text && r.text.length > 120 ? r.text.slice(0, 120).trimEnd() + "…" : r.text;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => selectReview(r.id)}
                      className={`w-full text-left px-4 py-3 transition ${isSelected ? "bg-brand-indigo/10" : "hover:bg-bg"}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <Avatar src={r.author_photo_url} name={r.author_name} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium truncate">{r.author_name ?? "Anonymous"}</span>
                            {typeof r.rating === "number" ? (
                              <span className="inline-flex items-center gap-0.5 text-amber-300 shrink-0"><Star className="h-3 w-3 fill-amber-300" />{r.rating}</span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-muted mt-0.5 truncate">
                            <MapPin className="h-3 w-3 inline mr-0.5 -mt-0.5" />
                            {r.location_title ?? "—"} · {r.relative_time || (r.publish_time ? new Date(r.publish_time).toLocaleDateString() : "—")}
                          </div>
                          {snippet ? <div className="text-xs text-muted mt-1 line-clamp-2">{snippet}</div> : <div className="text-[11px] italic text-muted mt-1">No text</div>}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail panel — full-width on mobile when selected */}
        <div className={`bg-bg-card border border-bg-border rounded-xl overflow-hidden ${selected ? "" : "hidden md:block"}`}>
          {selected ? (
            <ReviewDetail review={selected} onClose={() => selectReview(null)} />
          ) : (
            <div className="p-6 text-sm text-muted h-full flex items-center justify-center">
              <span>Select a review to view it.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string | null }) {
  const [errored, setErrored] = useState(false);
  if (src && !errored) {
    // Reviewer photos come from arbitrary Google CDN subdomains. Wiring next/image
    // would require an open remotePatterns rule we don't want — these are tiny
    // avatars and the bandwidth hit is negligible.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "Reviewer"}
        className="w-8 h-8 rounded-full bg-bg flex-shrink-0 object-cover"
        onError={() => setErrored(true)}
        referrerPolicy="no-referrer"
      />
    );
  }
  const initials = (name ?? "?").slice(0, 2).toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-brand-indigo/20 text-brand-indigo flex items-center justify-center text-[11px] font-medium flex-shrink-0">
      {src ? <ImageIcon className="h-4 w-4" /> : initials}
    </div>
  );
}

interface ReviewDetailProps {
  review: InboxReview;
  onClose: () => void;
}

function ReviewDetail({ review, onClose }: ReviewDetailProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bg-border md:hidden">
        <button onClick={onClose} className="text-xs text-muted hover:text-white flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>

      <div className="p-5 overflow-y-auto max-h-[700px]">
        <div className="flex items-start gap-3">
          <Avatar src={review.author_photo_url} name={review.author_name} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{review.author_name ?? "Anonymous"}</span>
              {typeof review.rating === "number" ? (
                <span className="inline-flex items-center gap-0.5 text-amber-300">
                  {Array.from({ length: review.rating }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-300" />)}
                </span>
              ) : null}
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              <MapPin className="h-3 w-3 inline mr-0.5 -mt-0.5" />
              {review.location_title ?? "—"} · {review.relative_time || (review.publish_time ? new Date(review.publish_time).toLocaleString() : "—")}
            </div>
          </div>
        </div>

        {review.text ? (
          <div className="text-sm text-white/90 mt-4 whitespace-pre-line">{review.text}</div>
        ) : (
          <div className="text-xs italic text-muted mt-4">Reviewer left no text.</div>
        )}

        {/* Single deep-link out to GBP — direct reply API isn't available until
            GMB v4 access propagates. Opens in a new tab so the user keeps the
            inbox state on return. */}
        {review.reply_on_google_url ? (
          <div className="mt-6">
            <a
              href={review.reply_on_google_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-brand-indigo text-white text-sm font-medium hover:bg-indigo-600 transition"
            >
              Reply on Google <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="text-[11px] text-muted mt-2">
              Opens Google Business Profile in a new tab. Inline replies will return once Google API access propagates.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
