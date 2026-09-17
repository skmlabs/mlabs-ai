"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExportButton } from "@/components/ExportButton";
import { OnboardingGate } from "@/components/OnboardingGate";
import { exportToExcel } from "@/lib/exportExcel";
import { timeAgo } from "@/lib/timeAgo";
import {
  AlertCircle, CheckCircle2, ExternalLink, Eye, Globe, Loader2, MapPin,
  Phone, RefreshCw, Search, Star, Trash2, X,
} from "lucide-react";

type CompetitorReview = {
  publishTime?: string;
  relativePublishTimeDescription?: string;
  rating?: number;
  text?: { text?: string };
  authorAttribution?: { displayName?: string; photoUri?: string };
};

type Estimates = {
  reviewVelocityPerMonth: number;
  estimatedCalls30d: number | null;
  estimatedDirections30d: number | null;
  estimatedWebsite30d: number | null;
  calibrationBasis: "city+category" | "city" | "category" | "global" | "none";
};

// `type` alias rather than `interface` so the shape is structurally assignable
// to `Record<string, unknown>` for exportToExcel — interfaces don't get an
// implicit index signature in TS strict.
type Competitor = {
  id: string;
  user_id: string;
  place_id: string;
  name: string;
  formatted_address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  category: string | null;
  google_maps_uri: string | null;
  rating: number | null;
  total_ratings: number | null;
  phone: string | null;
  website: string | null;
  recent_reviews: CompetitorReview[] | null;
  added_at: string;
  last_synced_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
  // Still computed server-side and used elsewhere; the Competitors table no
  // longer surfaces these columns.
  estimates: Estimates;
};

type OwnedLocation = { id: string; place_id: string | null };

function fmt(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function competitorUrl(c: Pick<Competitor, "google_maps_uri" | "place_id">): string {
  return c.google_maps_uri || `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(c.place_id)}`;
}

// "https://www.drmonga.com/clinic?utm=x" → "drmonga.com"
function prettyHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? url;
  }
}

export default function CompetitorsPage() {
  const router = useRouter();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [ownedLocations, setOwnedLocations] = useState<OwnedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; msg: string } | null>(null);

  const [query, setQuery] = useState("");

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [modalCompetitor, setModalCompetitor] = useState<Competitor | null>(null);

  const ownedWithPlaceId = useMemo(
    () => ownedLocations.filter(l => l.place_id),
    [ownedLocations],
  );
  const hasOwnedWithPlaceId = ownedWithPlaceId.length > 0;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, lRes] = await Promise.all([
        fetch("/api/competitors"),
        fetch("/api/gmb/locations"),
      ]);
      const cJson = await cRes.json() as { competitors?: Competitor[] };
      const lJson = await lRes.json() as { locations?: OwnedLocation[] };
      setCompetitors(cJson.competitors ?? []);
      setOwnedLocations(lJson.locations ?? []);
    } catch (e) {
      setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Failed to load competitors" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-dismiss success/info banners after 4s; leave errors so the user can read.
  useEffect(() => {
    if (!banner || banner.kind !== "success") return;
    const id = window.setTimeout(() => setBanner(null), 4000);
    return () => window.clearTimeout(id);
  }, [banner]);

  // The keyword box is a shortcut into the dedicated search page — that page
  // owns the filters, pagination and the add flow.
  function goToSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(`/dashboard/competitors/search${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  }

  async function removeCompetitor(c: Competitor) {
    if (!confirm(`Remove ${c.name} from tracked competitors?`)) return;
    setRemovingId(c.id); setBanner(null);
    try {
      const res = await fetch(`/api/competitors?id=${encodeURIComponent(c.id)}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(j.error ?? "Failed to remove");
      setCompetitors(prev => prev.filter(x => x.id !== c.id));
      setBanner({ kind: "success", msg: "Removed" });
    } catch (e) {
      setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Failed to remove" });
    } finally {
      setRemovingId(null);
    }
  }

  async function onExport() {
    if (competitors.length === 0) return;
    const datePart = new Date().toISOString().slice(0, 10);

    const flatRows = competitors.map(c => ({
      name: c.name,
      category: c.category,
      phone: c.phone,
      formatted_address: c.formatted_address,
      website: c.website,
      city: c.city,
      rating: c.rating,
      total_ratings: c.total_ratings,
      place_id: c.place_id,
      google_maps_uri: c.google_maps_uri,
    }));

    await exportToExcel(
      flatRows,
      [
        { key: "name", label: "Name" },
        { key: "category", label: "Category", format: v => typeof v === "string" ? v : "" },
        { key: "phone", label: "Phone", format: v => typeof v === "string" ? v : "" },
        { key: "formatted_address", label: "Address", format: v => typeof v === "string" ? v : "" },
        { key: "website", label: "Website", format: v => typeof v === "string" ? v : "" },
        { key: "city", label: "City", format: v => typeof v === "string" ? v : "" },
        { key: "rating", label: "Rating", format: v => typeof v === "number" ? v.toFixed(1) : "—" },
        { key: "total_ratings", label: "Total Reviews", format: v => typeof v === "number" ? v : "—" },
        { key: "place_id", label: "Place ID" },
        { key: "google_maps_uri", label: "Google Maps URL", format: v => typeof v === "string" ? v : "" },
      ],
      `competitors-${datePart}`,
      "Competitors",
    );
  }

  const lastSynced = useMemo(() => {
    const times = competitors
      .map(c => c.last_synced_at)
      .filter((v): v is string => typeof v === "string");
    if (times.length === 0) return null;
    return times.reduce((a, b) => (a > b ? a : b));
  }, [competitors]);

  // No GMB-synced locations at all → onboarding takes over the whole page.
  if (!loading && ownedLocations.length === 0) return <OnboardingGate />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Competitors</h1>
          <div className="text-xs text-muted mt-1 flex items-center gap-3 flex-wrap">
            <span>Track and benchmark nearby businesses.</span>
            {lastSynced ? (
              <span className="flex items-center gap-1">
                <RefreshCw className="h-3 w-3" />
                <span>Last synced {timeAgo(lastSynced)}</span>
              </span>
            ) : null}
          </div>
        </div>
        <ExportButton onClick={onExport} label="Export to Excel" disabled={competitors.length === 0} />
      </div>

      {/* Keyword box is a shortcut into the search page, which owns filters,
          pagination and the add flow. */}
      <form onSubmit={goToSearch} className="flex items-stretch gap-2">
        <div className={`flex-1 flex items-center gap-2 bg-bg-card border border-bg-border rounded-lg px-3 py-2 ${!hasOwnedWithPlaceId ? "opacity-60" : ""}`}>
          <Search className="h-4 w-4 text-muted shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={hasOwnedWithPlaceId ? "Search for competitors — e.g. dental clinic" : "Add an owned location first to enable competitor search"}
            disabled={!hasOwnedWithPlaceId}
            className="flex-1 bg-transparent text-sm placeholder:text-muted focus:outline-none disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="submit"
          disabled={!hasOwnedWithPlaceId}
          className="shrink-0 inline-flex items-center gap-2 bg-brand-indigo hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-medium text-white"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Find competitors</span>
        </button>
      </form>

      {banner ? (
        <div className={`rounded-lg px-4 py-2.5 text-sm flex items-start gap-2 ${
          banner.kind === "success"
            ? "bg-green-500/10 text-green-300 border border-green-500/20"
            : "bg-red-500/10 text-red-300 border border-red-500/20"
        }`}>
          {banner.kind === "success" ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{banner.msg}</span>
          <button onClick={() => setBanner(null)} className="text-xs hover:opacity-70"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : !hasOwnedWithPlaceId ? (
        <div className="bg-bg-card border border-bg-border rounded-xl p-8 text-center">
          <MapPin className="h-8 w-8 mx-auto text-brand-indigo mb-3" />
          <p className="text-sm text-muted mb-4">
            Add at least one location in My Locations before tracking competitors.
          </p>
          <Link href="/dashboard/locations" className="inline-block bg-brand-indigo hover:bg-indigo-600 px-4 py-2 rounded-lg text-sm font-medium text-white">
            Go to My Locations
          </Link>
        </div>
      ) : competitors.length === 0 ? (
        <div className="bg-bg-card border border-bg-border rounded-xl p-8 text-center text-sm text-muted">
          Track competitors to benchmark your locations.{" "}
          <Link href="/dashboard/competitors/search" className="text-brand-indigo hover:underline">
            Search for businesses to add
          </Link>.
        </div>
      ) : (
        <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-bg">
                <tr className="text-[11px] uppercase tracking-wider text-muted">
                  <th className="text-left px-4 py-2.5">Name</th>
                  <th className="text-left px-4 py-2.5">Phone</th>
                  <th className="text-left px-4 py-2.5">Address</th>
                  <th className="text-left px-4 py-2.5">Website</th>
                  <th className="text-left px-4 py-2.5">City</th>
                  <th className="text-right px-4 py-2.5">Rating</th>
                  <th className="text-right px-4 py-2.5">Total reviews</th>
                  <th className="text-center px-4 py-2.5">Reviews</th>
                  <th className="text-center px-4 py-2.5">Open</th>
                  <th className="text-center px-4 py-2.5">Remove</th>
                </tr>
              </thead>
              <tbody>
                {competitors.map(c => (
                  <tr key={c.id} className="border-t border-bg-border hover:bg-bg/60 transition">
                    <td className="px-4 py-3">
                      <a
                        href={competitorUrl(c)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:text-brand-indigo flex items-center gap-1.5"
                      >
                        <MapPin className="h-3.5 w-3.5 text-brand-indigo" /> {c.name}
                      </a>
                      {c.category ? <div className="text-[11px] text-muted mt-0.5 ml-5">{c.category}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone.replace(/\s+/g, "")}`}
                          className="inline-flex items-center gap-1.5 text-muted hover:text-white whitespace-nowrap"
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0" /> {c.phone}
                        </a>
                      ) : <span className="text-muted/60">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted max-w-[260px]">
                      {c.formatted_address
                        ? <span className="block truncate" title={c.formatted_address}>{c.formatted_address}</span>
                        : <span className="text-muted/60">—</span>}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      {c.website ? (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={c.website}
                          className="inline-flex items-center gap-1.5 text-brand-indigo hover:underline max-w-full"
                        >
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{prettyHost(c.website)}</span>
                        </a>
                      ) : <span className="text-muted/60">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted">{c.city ?? <span className="text-muted/60">—</span>}</td>
                    <td className="px-4 py-3 text-right">
                      {c.rating != null
                        ? <span className="inline-flex items-center gap-1 text-amber-300"><Star className="h-3 w-3 fill-amber-300" /> {c.rating.toFixed(1)}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{fmt(c.total_ratings)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setModalCompetitor(c)}
                        className="text-muted hover:text-white"
                        title="View recent reviews"
                        aria-label="View recent reviews"
                      >
                        <Eye className="h-4 w-4 inline" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <a
                        href={competitorUrl(c)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted hover:text-white"
                        title="Open in Google Maps"
                        aria-label="Open in Google Maps"
                      >
                        <ExternalLink className="h-4 w-4 inline" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeCompetitor(c)}
                        disabled={removingId === c.id}
                        className="text-red-300 hover:text-red-200 disabled:opacity-50"
                        title="Remove competitor"
                        aria-label="Remove competitor"
                      >
                        {removingId === c.id ? <Loader2 className="h-4 w-4 animate-spin inline" /> : <Trash2 className="h-4 w-4 inline" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reviews modal */}
      {modalCompetitor ? (
        <ReviewsModal competitor={modalCompetitor} onClose={() => setModalCompetitor(null)} />
      ) : null}
    </div>
  );
}

function ReviewsModal({ competitor, onClose }: { competitor: Competitor; onClose: () => void }) {
  const reviews = (competitor.recent_reviews ?? []) as CompetitorReview[];

  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm">
      <div className="bg-bg-card border border-bg-border rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-3 border-b border-bg-border">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{competitor.name}</div>
            <div className="text-[11px] text-muted truncate">
              {competitor.formatted_address ?? "—"}
              {typeof competitor.rating === "number" ? ` · ${competitor.rating.toFixed(1)} ★` : ""}
              {typeof competitor.total_ratings === "number" ? ` · ${competitor.total_ratings.toLocaleString()} reviews` : ""}
            </div>
            {competitor.phone || competitor.website ? (
              <div className="text-[11px] text-muted mt-1 flex items-center gap-3 flex-wrap">
                {competitor.phone ? (
                  <a href={`tel:${competitor.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 hover:text-white">
                    <Phone className="h-3 w-3" /> {competitor.phone}
                  </a>
                ) : null}
                {competitor.website ? (
                  <a href={competitor.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-indigo hover:underline">
                    <Globe className="h-3 w-3" /> {prettyHost(competitor.website)}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-white shrink-0">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {reviews.length === 0 ? (
            <div className="text-sm text-muted">No cached reviews. Wait for the next sync.</div>
          ) : (
            <ul className="space-y-4">
              {reviews.map((r, idx) => (
                <li key={`${r.publishTime ?? idx}`} className="border-b border-bg-border pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-xs font-medium">{r.authorAttribution?.displayName ?? "Anonymous"}</div>
                    <div className="flex items-center gap-2">
                      {typeof r.rating === "number" ? (
                        <span className="inline-flex items-center gap-0.5 text-amber-300 text-xs">
                          {Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="h-3 w-3 fill-amber-300" />)}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-muted">
                        {r.relativePublishTimeDescription || (r.publishTime ? new Date(r.publishTime).toLocaleDateString() : "")}
                      </span>
                    </div>
                  </div>
                  {r.text?.text ? (
                    <div className="text-xs text-muted mt-1.5 whitespace-pre-line">{r.text.text}</div>
                  ) : (
                    <div className="text-[11px] text-muted italic mt-1.5">No text</div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-bg-border flex items-center justify-end">
          <a
            href={competitorUrl(competitor)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-brand-indigo text-white text-sm font-medium hover:bg-indigo-600 transition"
          >
            Open on Google <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
