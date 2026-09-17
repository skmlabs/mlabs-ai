"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CATEGORY_GROUPS } from "@/lib/places/categories";
import {
  AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, Globe, Loader2,
  MapPin, Plus, Search, Star, X,
} from "lucide-react";

type PlaceResult = {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text: string };
  googleMapsUri?: string;
  websiteUri?: string;
};

type WebsiteFilter = "any" | "has" | "none";

type FormState = {
  q: string;
  category: string;
  city: string;
  pincode: string;
  minRating: string;
  minReviews: string;
  maxReviews: string;
  website: WebsiteFilter;
};

const EMPTY_FORM: FormState = {
  q: "",
  category: "",
  city: "",
  pincode: "",
  minRating: "",
  minReviews: "",
  maxReviews: "",
  website: "any",
};

const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "3", label: "3.0+" },
  { value: "3.5", label: "3.5+" },
  { value: "4", label: "4.0+" },
  { value: "4.5", label: "4.5+" },
];

// Text Search (New) serves 20 per page, 60 max across 3 pages.
const PAGE_SIZE = 20;
const MAX_RESULTS = 60;

function formFromParams(sp: URLSearchParams): FormState {
  const website = sp.get("website");
  return {
    q: sp.get("q") ?? "",
    category: sp.get("category") ?? "",
    city: sp.get("city") ?? "",
    pincode: sp.get("pincode") ?? "",
    minRating: sp.get("minRating") ?? "",
    minReviews: sp.get("minReviews") ?? "",
    maxReviews: sp.get("maxReviews") ?? "",
    website: website === "has" || website === "none" ? website : "any",
  };
}

function paramsFromForm(f: FormState): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  if (f.category) p.set("category", f.category);
  if (f.city.trim()) p.set("city", f.city.trim());
  if (f.pincode.trim()) p.set("pincode", f.pincode.trim());
  if (f.minRating) p.set("minRating", f.minRating);
  if (f.minReviews.trim()) p.set("minReviews", f.minReviews.trim());
  if (f.maxReviews.trim()) p.set("maxReviews", f.maxReviews.trim());
  if (f.website !== "any") p.set("website", f.website);
  return p;
}

function isSearchable(f: FormState): boolean {
  return Boolean(f.category) || f.q.trim().length >= 3;
}

function prettyHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? url;
  }
}

function placeUrl(p: PlaceResult): string {
  return p.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.id)}`;
}

export default function CompetitorSearchPage() {
  // useSearchParams needs a Suspense boundary when the route is prerendered.
  return (
    <Suspense fallback={<div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}>
      <CompetitorSearch />
    </Suspense>
  );
}

function CompetitorSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlKey = searchParams.toString();
  const [form, setForm] = useState<FormState>(() => formFromParams(new URLSearchParams(urlKey)));

  const [results, setResults] = useState<PlaceResult[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [rawCount, setRawCount] = useState(0);      // pre-filter results seen
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trackedPlaceIds, setTrackedPlaceIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const websiteShown = (searchParams.get("website") ?? "any") !== "any";

  // Tracked competitors — so already-added places render as "Tracked".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/competitors");
        const j = await res.json() as { competitors?: Array<{ place_id: string }> };
        if (!cancelled) {
          setTrackedPlaceIds(new Set((j.competitors ?? []).map(c => c.place_id)));
        }
      } catch { /* non-fatal — rows just won't show as tracked */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!banner || banner.kind !== "success") return;
    const id = window.setTimeout(() => setBanner(null), 3000);
    return () => window.clearTimeout(id);
  }, [banner]);

  // Keep the visible form in step with the URL (back/forward, shared links).
  useEffect(() => {
    setForm(formFromParams(new URLSearchParams(urlKey)));
  }, [urlKey]);

  // Run the search whenever the URL query changes. Each page is a separately
  // billed Places call, so this fires on submit — never on keystroke.
  useEffect(() => {
    const sp = new URLSearchParams(urlKey);
    const f = formFromParams(sp);
    if (!isSearchable(f)) {
      setResults([]); setNextPageToken(null); setRawCount(0); setSearched(false);
      return;
    }
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/competitors/search?${sp.toString()}`);
        const j = await res.json() as {
          results?: PlaceResult[];
          nextPageToken?: string | null;
          total?: number;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) throw new Error(j.error ?? "Search failed");
        setResults(j.results ?? []);
        setNextPageToken(j.nextPageToken ?? null);
        setRawCount(j.total ?? 0);
        setSearched(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Search failed");
          setResults([]); setNextPageToken(null); setRawCount(0); setSearched(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [urlKey]);

  const loadMore = useCallback(async () => {
    if (!nextPageToken) return;
    setLoadingMore(true); setError(null);
    try {
      const sp = new URLSearchParams(urlKey);
      sp.set("pageToken", nextPageToken);
      const res = await fetch(`/api/competitors/search?${sp.toString()}`);
      const j = await res.json() as {
        results?: PlaceResult[];
        nextPageToken?: string | null;
        total?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(j.error ?? "Failed to load more");
      // De-dupe defensively — Google can repeat a place across page boundaries.
      setResults(prev => {
        const seen = new Set(prev.map(r => r.id));
        return [...prev, ...(j.results ?? []).filter(r => !seen.has(r.id))];
      });
      setNextPageToken(j.nextPageToken ?? null);
      setRawCount(n => n + (j.total ?? 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }, [nextPageToken, urlKey]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.pincode.trim() && !/^\d{6}$/.test(form.pincode.trim())) {
      setError("PIN code must be 6 digits");
      return;
    }
    const p = paramsFromForm(form);
    router.replace(`/dashboard/competitors/search${p.toString() ? `?${p.toString()}` : ""}`);
  }

  function onReset() {
    setForm(EMPTY_FORM);
    router.replace("/dashboard/competitors/search");
  }

  async function add(place: PlaceResult) {
    setAddingId(place.id); setBanner(null);
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: place.id }),
      });
      const j = await res.json() as { error?: string };
      if (!res.ok && res.status !== 409) throw new Error(j.error ?? "Failed to add");
      setTrackedPlaceIds(prev => new Set(prev).add(place.id));
      setBanner(
        res.status === 409
          ? { kind: "success", msg: `${place.displayName.text} was already tracked` }
          : { kind: "success", msg: `Added ${place.displayName.text}` },
      );
    } catch (e) {
      setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Failed to add" });
    } finally {
      setAddingId(null);
    }
  }

  const addedCount = useMemo(
    () => results.filter(r => trackedPlaceIds.has(r.id)).length,
    [results, trackedPlaceIds],
  );

  const reachedCap = rawCount >= MAX_RESULTS || !nextPageToken;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            href="/dashboard/competitors"
            className="text-xs text-muted hover:text-white inline-flex items-center gap-1.5 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to tracked competitors
          </Link>
          <h1 className="text-2xl font-bold">Find competitors</h1>
          <p className="text-xs text-muted mt-1">
            Search Google Business Profiles by keyword, category, city or PIN code, then add the ones you want to track.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="bg-bg-card border border-bg-border rounded-xl p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block lg:col-span-2">
            <span className="block text-[11px] uppercase tracking-wider text-muted mb-1">Keyword</span>
            <div className="flex items-center gap-2 bg-bg border border-bg-border rounded-md px-2.5 py-1.5 focus-within:border-brand-indigo">
              <Search className="h-4 w-4 text-muted shrink-0" />
              <input
                type="text"
                value={form.q}
                onChange={e => setField("q", e.target.value)}
                placeholder="e.g. dental clinic"
                className="flex-1 bg-transparent text-sm placeholder:text-muted focus:outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-muted mb-1">Category</span>
            <select
              value={form.category}
              onChange={e => setField("category", e.target.value)}
              className="w-full bg-bg border border-bg-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-indigo"
            >
              <option value="">Any category</option>
              {CATEGORY_GROUPS.map(g => (
                <optgroup key={g.group} label={g.group}>
                  {g.options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-muted mb-1">City</span>
            <input
              type="text"
              value={form.city}
              onChange={e => setField("city", e.target.value)}
              placeholder="e.g. Gurgaon"
              className="w-full bg-bg border border-bg-border rounded-md px-2.5 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-brand-indigo"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-muted mb-1">PIN code</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={form.pincode}
              onChange={e => setField("pincode", e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 110024"
              className="w-full bg-bg border border-bg-border rounded-md px-2.5 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-brand-indigo"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-muted mb-1">Rating</span>
            <select
              value={form.minRating}
              onChange={e => setField("minRating", e.target.value)}
              className="w-full bg-bg border border-bg-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-indigo"
            >
              {RATING_OPTIONS.map(o => (
                <option key={o.value || "any"} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-muted mb-1">Min reviews</span>
            <input
              type="number"
              min={0}
              value={form.minReviews}
              onChange={e => setField("minReviews", e.target.value)}
              placeholder="0"
              className="w-full bg-bg border border-bg-border rounded-md px-2.5 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-brand-indigo"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-muted mb-1">Max reviews</span>
            <input
              type="number"
              min={0}
              value={form.maxReviews}
              onChange={e => setField("maxReviews", e.target.value)}
              placeholder="Any"
              className="w-full bg-bg border border-bg-border rounded-md px-2.5 py-1.5 text-sm placeholder:text-muted focus:outline-none focus:border-brand-indigo"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] uppercase tracking-wider text-muted mb-1">Website</span>
            <select
              value={form.website}
              onChange={e => setField("website", e.target.value as WebsiteFilter)}
              className="w-full bg-bg border border-bg-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-indigo"
            >
              <option value="any">Any</option>
              <option value="has">Has a website</option>
              <option value="none">No website</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
          <span className="text-[11px] text-muted">
            Give a keyword or pick a category. City and PIN code narrow the search itself; the rest filter the results.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-muted hover:text-white inline-flex items-center gap-1"
            >
              <X className="h-3.5 w-3.5" /> Reset
            </button>
            <button
              type="submit"
              disabled={!isSearchable(form) || loading}
              className="inline-flex items-center gap-2 bg-brand-indigo hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </button>
          </div>
        </div>
      </form>

      {banner ? (
        <div className={`rounded-lg px-4 py-2.5 text-sm flex items-start gap-2 ${
          banner.kind === "success"
            ? "bg-green-500/10 text-green-300 border border-green-500/20"
            : "bg-red-500/10 text-red-300 border border-red-500/20"
        }`}>
          {banner.kind === "success" ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{banner.msg}</span>
          <button type="button" onClick={() => setBanner(null)} className="hover:opacity-70"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg px-4 py-2.5 text-sm flex items-start gap-2 bg-red-500/10 text-red-300 border border-red-500/20">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</div>
      ) : !searched ? (
        <div className="bg-bg-card border border-bg-border rounded-xl p-8 text-center text-sm text-muted">
          Enter a keyword or pick a category, then hit Search.
        </div>
      ) : results.length === 0 ? (
        <div className="bg-bg-card border border-bg-border rounded-xl p-8 text-center text-sm text-muted">
          {rawCount > 0
            ? `No matches — all ${rawCount} Google result${rawCount === 1 ? " was" : "s were"} filtered out. Try relaxing the filters.`
            : "No results. Try a broader keyword, or drop the city / PIN code."}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted">
            <span>
              Showing <span className="text-white font-medium">{results.length}</span>
              {rawCount > results.length ? <> of {rawCount} Google results after filters</> : <> result{results.length === 1 ? "" : "s"}</>}
              {addedCount > 0 ? <> · {addedCount} already tracked</> : null}
            </span>
          </div>

          <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="bg-bg">
                  <tr className="text-[11px] uppercase tracking-wider text-muted">
                    <th className="text-left px-4 py-2.5">Name</th>
                    <th className="text-left px-4 py-2.5">Address</th>
                    {websiteShown ? <th className="text-left px-4 py-2.5">Website</th> : null}
                    <th className="text-right px-4 py-2.5">Rating</th>
                    <th className="text-right px-4 py-2.5">Reviews</th>
                    <th className="text-center px-4 py-2.5">Maps</th>
                    <th className="text-right px-4 py-2.5">Add</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => {
                    const tracked = trackedPlaceIds.has(r.id);
                    return (
                      <tr key={r.id} className="border-t border-bg-border hover:bg-bg/60 transition">
                        <td className="px-4 py-3">
                          <div className="font-medium flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-brand-indigo shrink-0" /> {r.displayName.text}
                          </div>
                          {r.primaryTypeDisplayName?.text ? (
                            <div className="text-[11px] text-muted mt-0.5 ml-5">{r.primaryTypeDisplayName.text}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-muted max-w-[320px]">
                          <span className="block truncate" title={r.formattedAddress}>{r.formattedAddress}</span>
                        </td>
                        {websiteShown ? (
                          <td className="px-4 py-3 max-w-[180px]">
                            {r.websiteUri ? (
                              <a
                                href={r.websiteUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={r.websiteUri}
                                className="inline-flex items-center gap-1.5 text-brand-indigo hover:underline max-w-full"
                              >
                                <Globe className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{prettyHost(r.websiteUri)}</span>
                              </a>
                            ) : <span className="text-muted/60">—</span>}
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-right">
                          {typeof r.rating === "number"
                            ? <span className="inline-flex items-center gap-1 text-amber-300"><Star className="h-3 w-3 fill-amber-300" /> {r.rating.toFixed(1)}</span>
                            : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {typeof r.userRatingCount === "number" ? r.userRatingCount.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <a
                            href={placeUrl(r)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted hover:text-white"
                            title="Open in Google Maps"
                            aria-label="Open in Google Maps"
                          >
                            <ExternalLink className="h-4 w-4 inline" />
                          </a>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {tracked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-green-300">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Tracked
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => add(r)}
                              disabled={addingId === r.id}
                              className="inline-flex items-center gap-1.5 bg-brand-indigo hover:bg-indigo-600 disabled:opacity-50 px-3 py-1.5 rounded-md text-xs font-medium text-white"
                            >
                              {addingId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                              Add
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-center pt-1">
            {nextPageToken ? (
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 bg-bg-card border border-bg-border hover:border-brand-indigo/60 disabled:opacity-50 px-4 py-2 rounded-lg text-sm"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Load {PAGE_SIZE} more
              </button>
            ) : searched && reachedCap ? (
              <span className="text-[11px] text-muted">
                {rawCount >= MAX_RESULTS
                  ? `That's all ${MAX_RESULTS} results Google returns for one search — narrow the keyword, category or PIN code to see different businesses.`
                  : "End of results."}
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
