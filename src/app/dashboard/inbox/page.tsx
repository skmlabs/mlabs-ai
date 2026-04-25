"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DateRangePills } from "@/components/DateRangePills";
import { normalizeRangeKey, type DateRangeKey } from "@/lib/dateRange";
import { timeAgo, formatTatSeconds } from "@/lib/timeAgo";
import { Loader2, RefreshCw, Star, MapPin, MessageSquare, Image as ImageIcon, ArrowLeft, Trash2, Edit2, X } from "lucide-react";

const MAX_REPLY_LENGTH = 4000;

type StatusFilter = "all" | "responded" | "unresponded";
type SortKey = "newest" | "oldest" | "lowest_rating";

interface InboxReview {
  id: string;
  location_id: string;
  location_title: string | null;
  google_review_name: string;
  author_name: string | null;
  author_photo_url: string | null;
  rating: number | null;
  text: string | null;
  publish_time: string | null;
  update_time: string | null;
  reply_text: string | null;
  reply_create_time: string | null;
  reply_update_time: string | null;
  replied_by_user_id: string | null;
  replied_by_name: string | null;
  has_reply: boolean | null;
  first_response_tat_seconds: number | null;
}

interface InboxResponse {
  range: { key: DateRangeKey; label: string; start: string; end: string };
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

interface SyncStatusResponse {
  last_synced_at: string | null;
  in_progress: boolean;
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
  const range = normalizeRangeKey(search.get("range"));
  const customStart = search.get("start") ?? undefined;
  const customEnd = search.get("end") ?? undefined;
  const ratingsFromUrl = (search.get("rating") ?? "").split(",").map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 5);
  const statusFromUrl = (search.get("status") as StatusFilter | null) ?? "all";
  const sortFromUrl = (search.get("sort") as SortKey | null) ?? "newest";
  const locationFilter = search.get("location_id");
  const selectedFromUrl = search.get("review");

  const [data, setData] = useState<InboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(selectedFromUrl);
  const [banner, setBanner] = useState<string | null>(null);

  // Reply UI state
  const [draftReply, setDraftReply] = useState<string>("");
  const [editingReply, setEditingReply] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ range });
      if (range === "custom" && customStart && customEnd) {
        qs.set("start", customStart);
        qs.set("end", customEnd);
      }
      if (ratingsFromUrl.length > 0) qs.set("rating", ratingsFromUrl.join(","));
      if (statusFromUrl !== "all") qs.set("status", statusFromUrl);
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
  }, [range, customStart, customEnd, search.get("rating"), statusFromUrl, sortFromUrl, locationFilter]);

  const loadSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync-status");
      if (res.ok) setSyncStatus(await res.json() as SyncStatusResponse);
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadSyncStatus(); }, [loadSyncStatus]);

  // When data loads or selection changes, reset reply draft
  useEffect(() => {
    setEditingReply(false);
    setDraftReply("");
  }, [selectedId, data]);

  // Keep selection valid; if URL has a stale id, clear it
  useEffect(() => {
    if (!data) return;
    if (selectedId && !data.reviews.find(r => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [data, selectedId]);

  const selected = useMemo(
    () => data?.reviews.find(r => r.id === selectedId) ?? null,
    [data, selectedId]
  );

  function updateUrl(updater: (p: URLSearchParams) => void) {
    const p = new URLSearchParams(search.toString());
    updater(p);
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setRange(k: DateRangeKey) {
    updateUrl(p => {
      p.set("range", k);
      if (k !== "custom") { p.delete("start"); p.delete("end"); }
    });
  }

  function applyCustomRange(start: string, end: string) {
    updateUrl(p => {
      p.set("range", "custom");
      p.set("start", start);
      p.set("end", end);
    });
  }

  function toggleRating(n: number) {
    const next = ratingsFromUrl.includes(n) ? ratingsFromUrl.filter(x => x !== n) : [...ratingsFromUrl, n].sort();
    updateUrl(p => {
      if (next.length === 0) p.delete("rating");
      else p.set("rating", next.join(","));
    });
  }

  function setStatus(s: StatusFilter) {
    updateUrl(p => {
      if (s === "all") p.delete("status");
      else p.set("status", s);
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

  async function syncNow() {
    setSyncing(true); setBanner(null);
    try {
      const qs = new URLSearchParams({ range });
      if (range === "custom" && customStart && customEnd) { qs.set("start", customStart); qs.set("end", customEnd); }
      const res = await fetch(`/api/gmb/sync-now?${qs.toString()}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "sync failed");
      setBanner(`Synced ${j.reviews.total_fetched} review(s) across ${j.reviews.locations} location(s).`);
      await Promise.all([load(), loadSyncStatus()]);
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Sync failed");
    } finally { setSyncing(false); }
  }

  async function postReply() {
    if (!selected || !draftReply.trim()) return;
    setReplyBusy(true); setBanner(null);
    try {
      const method = selected.has_reply ? "PATCH" : "POST";
      const res = await fetch(`/api/reviews/${selected.id}/reply`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply_text: draftReply.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Reply failed");
      setBanner("Reply posted to Google Business Profile.");
      setEditingReply(false);
      setDraftReply("");
      await load();
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Reply failed");
    } finally { setReplyBusy(false); }
  }

  async function deleteReply() {
    if (!selected || !selected.has_reply) return;
    if (!confirm("Delete this reply on Google Business Profile?")) return;
    setReplyBusy(true); setBanner(null);
    try {
      const res = await fetch(`/api/reviews/${selected.id}/reply`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Delete failed");
      setBanner("Reply removed.");
      await load();
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Delete failed");
    } finally { setReplyBusy(false); }
  }

  const reviews = data?.reviews ?? [];
  const metrics = data?.metrics;
  const locations = data?.locations ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reviews Inbox</h1>
          <div className="text-xs text-muted mt-1 flex items-center gap-3 flex-wrap">
            <span>{data?.range.label} · {data?.range.start} to {data?.range.end}</span>
            <span className="flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              <span>Last synced {timeAgo(syncStatus?.last_synced_at)}</span>
              <button onClick={syncNow} disabled={syncing} className="text-brand-indigo hover:underline disabled:opacity-50 ml-1">
                {syncing ? "Syncing…" : "Sync now"}
              </button>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePills value={range} onChange={setRange} onCustomApply={applyCustomRange} customStart={customStart} customEnd={customEnd} />
        </div>
      </div>

      {banner ? (
        <div className="bg-bg-card border border-bg-border rounded-lg px-4 py-2.5 text-sm text-muted flex items-start gap-2">
          <span className="flex-1">{banner}</span>
          <button onClick={() => setBanner(null)} className="text-xs text-muted hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      {/* Reputation metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ReputationCard label="Avg first response" value={formatTatSeconds(metrics?.avg_tat_seconds ?? null)} accent="indigo" />
        <ReputationCard label="% Responded" value={metrics ? `${metrics.responded_pct}%` : "—"} accent="emerald" />
        <ReputationCard label="Need reply" value={metrics ? String(metrics.unresponded_in_range) : "—"} accent={metrics && metrics.unresponded_in_range > 0 ? "amber" : "neutral"} />
        <ReputationCard label="Median TAT" value={formatTatSeconds(metrics?.median_tat_seconds ?? null)} accent="indigo" />
      </div>

      {/* 3-column on desktop, single-pane on mobile (selection toggles to detail) */}
      <div className="grid md:grid-cols-[220px_minmax(0,360px)_minmax(0,1fr)] gap-4">
        {/* Filter sidebar — hidden on mobile when a review is selected */}
        <aside className={`bg-bg-card border border-bg-border rounded-xl p-4 space-y-5 ${selected ? "hidden md:block" : ""}`}>
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
            <span>{reviews.length} reviews{metrics && metrics.unresponded_in_range > 0 ? ` · ${metrics.unresponded_in_range} need reply` : ""}</span>
          </div>
          {loading ? (
            <div className="p-6 text-sm text-muted flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : reviews.length === 0 ? (
            <div className="p-6 text-sm text-muted">No reviews match your filters. Try widening the date range or clicking <span className="text-brand-indigo">Sync now</span>.</div>
          ) : (
            <ul className="flex-1 overflow-y-auto max-h-[640px] divide-y divide-bg-border">
              {reviews.map(r => {
                const isSelected = r.id === selectedId;
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
                            {r.has_reply === false ? (
                              <span className="ml-auto shrink-0 text-[10px] font-bold uppercase tracking-wider bg-brand-amber/20 text-brand-amber px-1.5 py-0.5 rounded">Needs reply</span>
                            ) : null}
                          </div>
                          <div className="text-[11px] text-muted mt-0.5 truncate">
                            <MapPin className="h-3 w-3 inline mr-0.5 -mt-0.5" />
                            {r.location_title ?? "—"} · {r.publish_time ? new Date(r.publish_time).toLocaleDateString() : "—"}
                          </div>
                          {r.text ? <div className="text-xs text-muted mt-1 line-clamp-2">{r.text}</div> : <div className="text-[11px] italic text-muted mt-1">No text</div>}
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
            <ReviewDetail
              review={selected}
              draftReply={draftReply}
              setDraftReply={setDraftReply}
              editingReply={editingReply}
              setEditingReply={setEditingReply}
              replyBusy={replyBusy}
              onPost={postReply}
              onDelete={deleteReply}
              onClose={() => selectReview(null)}
            />
          ) : (
            <div className="p-6 text-sm text-muted h-full flex items-center justify-center">
              <span>Select a review to view it and reply.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReputationCard({ label, value, accent }: { label: string; value: string; accent: "indigo" | "amber" | "emerald" | "neutral" }) {
  const accentCls = {
    indigo: "text-brand-indigo",
    amber: "text-brand-amber",
    emerald: "text-emerald-400",
    neutral: "text-white",
  }[accent];
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accentCls}`}>{value}</div>
    </div>
  );
}

function Avatar({ src, name }: { src: string | null; name: string | null }) {
  const [errored, setErrored] = useState(false);
  if (src && !errored) {
    // Reviewer photos come from arbitrary Google CDN subdomains (lh*.googleusercontent.com,
    // googleapis.com, etc.). Wiring next/image would require an open remotePatterns rule
    // for those hosts, which we don't want — these are tiny avatars and the bandwidth
    // hit is negligible.
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
  draftReply: string;
  setDraftReply: (s: string) => void;
  editingReply: boolean;
  setEditingReply: (b: boolean) => void;
  replyBusy: boolean;
  onPost: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function ReviewDetail(props: ReviewDetailProps) {
  const { review, draftReply, setDraftReply, editingReply, setEditingReply, replyBusy, onPost, onDelete, onClose } = props;
  const showReplyForm = !review.has_reply || editingReply;
  const charsLeft = MAX_REPLY_LENGTH - draftReply.length;
  const tooLong = charsLeft < 0;

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
              {review.location_title ?? "—"} · {review.publish_time ? new Date(review.publish_time).toLocaleString() : "—"}
            </div>
          </div>
        </div>

        {review.text ? (
          <div className="text-sm text-white/90 mt-4 whitespace-pre-line">{review.text}</div>
        ) : (
          <div className="text-xs italic text-muted mt-4">Reviewer left no text.</div>
        )}

        {/* Existing reply card (when present and not in edit mode) */}
        {review.has_reply && !editingReply ? (
          <div className="mt-5 bg-bg border border-bg-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] uppercase tracking-wider text-muted flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Your reply
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setDraftReply(review.reply_text ?? ""); setEditingReply(true); }}
                  className="text-[11px] text-muted hover:text-white flex items-center gap-1"
                  disabled={replyBusy}
                >
                  <Edit2 className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={onDelete}
                  disabled={replyBusy}
                  className="text-[11px] text-red-300 hover:text-red-200 flex items-center gap-1 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </div>
            <div className="text-sm text-white/90 whitespace-pre-line">{review.reply_text}</div>
            <div className="text-[11px] text-muted mt-2">
              {review.replied_by_name ? `Replied by ${review.replied_by_name}` : "Replied"}
              {review.reply_create_time ? ` on ${new Date(review.reply_create_time).toLocaleString()}` : ""}
              {typeof review.first_response_tat_seconds === "number" ? ` · TAT ${formatTatSeconds(review.first_response_tat_seconds)}` : ""}
            </div>
          </div>
        ) : null}

        {/* Reply form */}
        {showReplyForm ? (
          <div className="mt-5 space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-muted flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> {review.has_reply ? "Edit reply" : "Reply to this review"}
            </div>
            <textarea
              value={draftReply}
              onChange={e => setDraftReply(e.target.value)}
              placeholder="Thank the reviewer, address concerns, or invite them back…"
              className="w-full min-h-[120px] bg-bg border border-bg-border rounded-md px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:border-brand-indigo"
              disabled={replyBusy}
            />
            <div className="flex items-center justify-between gap-3">
              <div className={`text-[11px] ${tooLong ? "text-red-400" : "text-muted"}`}>
                {tooLong ? `${-charsLeft} over limit` : `${draftReply.length} / ${MAX_REPLY_LENGTH}`}
              </div>
              <div className="flex gap-2">
                {editingReply ? (
                  <button
                    onClick={() => { setEditingReply(false); setDraftReply(""); }}
                    disabled={replyBusy}
                    className="text-xs px-3 py-1.5 rounded-md border border-bg-border text-muted hover:text-white disabled:opacity-50"
                  >
                    Cancel
                  </button>
                ) : null}
                <button
                  onClick={onPost}
                  disabled={replyBusy || tooLong || draftReply.trim().length === 0}
                  className="text-xs px-3 py-1.5 rounded-md bg-brand-indigo text-white font-medium disabled:opacity-50 flex items-center gap-1.5"
                >
                  {replyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {review.has_reply ? "Save reply" : "Post reply"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
