"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Download, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import type { AIInsightsResponse } from "@/lib/types/aiInsights";
import { EyebrowText } from "@/components/ai-insights/EyebrowText";
import { ExecutiveBrief } from "@/components/ai-insights/ExecutiveBrief";
import { ScorecardStrip } from "@/components/ai-insights/ScorecardStrip";
import { ReviewVelocityChart } from "@/components/ai-insights/ReviewVelocityChart";
import { ChartFindings } from "@/components/ai-insights/ChartFindings";
import { ThemesGrid } from "@/components/ai-insights/ThemesGrid";
import { CompetitivePosition } from "@/components/ai-insights/CompetitivePosition";
import { CatchmentIntelligence } from "@/components/ai-insights/CatchmentIntelligence";
import { RecommendationsList } from "@/components/ai-insights/RecommendationsList";
import { SkeletonCard } from "@/components/ai-insights/SkeletonCard";

interface InsightsResponse {
  insights?: AIInsightsResponse;
  cached?: boolean;
  error?: string;
  message?: string;
  regenerateLockedUntilHours?: number;
  retryAfter?: number;
  lastRegeneratedAt?: string | null;
}

interface Section {
  id: string;
  title: string;
}

const SECTIONS: Section[] = [
  { id: "executive-brief", title: "Executive Brief" },
  { id: "performance-snapshot", title: "Performance Snapshot" },
  { id: "review-momentum", title: "Review Momentum" },
  { id: "review-themes", title: "Review Themes" },
  { id: "competitive-position", title: "Competitive Position" },
  { id: "catchment-intelligence", title: "Catchment Intelligence" },
  { id: "strategic-recommendations", title: "Strategic Recommendations" },
];

export default function AiInsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerateBanner, setRegenerateBanner] = useState<string | null>(null);
  const [regenerateLockedHours, setRegenerateLockedHours] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(SECTIONS[0]?.id ?? null);

  const load = useCallback(async (force: boolean) => {
    if (force) setRegenerating(true); else setLoading(true);
    setError(null);
    if (force) setRegenerateBanner(null);
    try {
      const res = await fetch(`/api/ai-insights${force ? "?force=1" : ""}`, { cache: "no-store" });
      const j = await res.json() as InsightsResponse;

      if (res.status === 429) {
        const msg = j.error ?? "AI Insights can be regenerated once every 24 hours.";
        setRegenerateBanner(msg);
        if (typeof j.regenerateLockedUntilHours === "number") {
          setRegenerateLockedHours(j.regenerateLockedUntilHours);
        }
        return;
      }

      if (!res.ok) {
        // 502 generation_failed and other errors land here.
        const msg = j.message ?? j.error ?? `Request failed: ${res.status}`;
        throw new Error(msg);
      }
      setData(j);
      setRegenerateLockedHours(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      if (force) setRegenerating(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  // Cooldown banner auto-dismiss.
  useEffect(() => {
    if (!regenerateBanner) return;
    const id = window.setTimeout(() => setRegenerateBanner(null), 6000);
    return () => window.clearTimeout(id);
  }, [regenerateBanner]);

  // Active section highlighting via IntersectionObserver on rendered section nodes.
  useEffect(() => {
    if (!data?.insights) return;
    const headings = SECTIONS
      .map(s => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) setActiveSection(first.target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );
    for (const h of headings) observer.observe(h);
    return () => observer.disconnect();
  }, [data?.insights]);

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  function downloadAsPdf() {
    window.print();
  }

  const insights = data?.insights;
  const businessName =
    insights?.competitive_comparison?.headers?.[1] ?? "your business";

  return (
    <div className="space-y-4">
      {/* Print stylesheet — strips chrome and switches to black-on-white for the PDF. */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .ai-insights-no-print { display: none !important; }
          .ai-insights-content {
            color: black !important;
            background: white !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="ai-insights-no-print flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-indigo" /> AI Insights
          </h1>
          {data?.lastRegeneratedAt ? (
            <p className="text-xs text-muted mt-1">
              Last regenerated on {new Date(data.lastRegeneratedAt).toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadAsPdf}
            disabled={!insights}
            className="text-xs border border-bg-border hover:border-brand-indigo rounded-md px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Download as PDF
          </button>
          <button
            onClick={() => load(true)}
            disabled={regenerating || loading || regenerateLockedHours !== null}
            title={regenerateLockedHours !== null
              ? `Available again in ${regenerateLockedHours} hour${regenerateLockedHours === 1 ? "" : "s"}`
              : undefined}
            className="text-xs bg-brand-indigo hover:bg-indigo-600 rounded-md px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50 text-white font-medium"
          >
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {regenerating
              ? "Regenerating…"
              : regenerateLockedHours !== null
                ? `Available in ${regenerateLockedHours}h`
                : "Regenerate"}
          </button>
        </div>
      </div>

      {/* Cooldown banner */}
      {regenerateBanner ? (
        <div className="ai-insights-no-print bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 text-sm text-amber-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{regenerateBanner}</span>
          <button onClick={() => setRegenerateBanner(null)} className="text-xs hover:opacity-70" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Body states */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={() => load(false)} />
      ) : !insights ? (
        <ErrorState error="No insights returned." onRetry={() => load(true)} />
      ) : (
        <div className="grid lg:grid-cols-[200px_minmax(0,1fr)] gap-6">
          {/* Sticky section nav */}
          <aside className="ai-insights-no-print hidden lg:block">
            <nav className="sticky top-4 space-y-1 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-2">Sections</div>
              {SECTIONS.map(s => {
                const isActive = s.id === activeSection;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(s.id)}
                    className={`block w-full text-left px-2 py-1.5 rounded transition ${
                      isActive
                        ? "bg-brand-indigo/15 text-white border-l-2 border-brand-indigo pl-1.5"
                        : "text-muted hover:text-white"
                    }`}
                  >
                    {s.title}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <div className="ai-insights-content space-y-10 max-w-none">
            <section id="executive-brief">
              <EyebrowText>Executive Brief · {businessName}</EyebrowText>
              <ExecutiveBrief summary={insights.executive_summary} />
            </section>

            <section id="performance-snapshot">
              <EyebrowText>Performance Snapshot · 5 Key Metrics</EyebrowText>
              <ScorecardStrip scorecard={insights.scorecard} />
            </section>

            <section id="review-momentum">
              <EyebrowText>Review Momentum · Last 90 Days</EyebrowText>
              <ReviewVelocityChart data={insights.chart_data.review_velocity_90d} />
              <ChartFindings findings={insights.chart_data.chart_findings} />
            </section>

            <section id="review-themes">
              <EyebrowText>Review Themes · What Customers Are Saying</EyebrowText>
              <ThemesGrid themes={insights.themes} sentimentTrend={insights.sentiment_trend} />
            </section>

            <section id="competitive-position">
              <EyebrowText>Competitive Position · You vs Named Competitors</EyebrowText>
              <CompetitivePosition
                comparison={insights.competitive_comparison}
                bars={insights.chart_data.competitive_bars}
              />
            </section>

            <section id="catchment-intelligence">
              <EyebrowText>Catchment Intelligence · Demographics · Opportunity</EyebrowText>
              <CatchmentIntelligence intel={insights.catchment_intelligence} />
            </section>

            <section id="strategic-recommendations">
              <EyebrowText>Strategic Recommendations · Next 30 Days</EyebrowText>
              <RecommendationsList recommendations={insights.recommendations} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <SkeletonCard height="h-28" lines={2} />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} height="h-32" lines={2} />
        ))}
      </div>
      <SkeletonCard height="h-72" lines={3} />
      <div className="grid md:grid-cols-2 gap-4">
        <SkeletonCard height="h-40" lines={3} />
        <SkeletonCard height="h-40" lines={3} />
      </div>
      <p className="text-xs text-muted text-center mt-4">
        Generating a fresh brief. Usually 30-60 seconds.
      </p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-red-300 mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="text-sm font-medium text-red-200">Could not generate insights</div>
        <div className="text-xs text-red-200/80 mt-1 whitespace-pre-line">{error}</div>
      </div>
      <button
        onClick={onRetry}
        className="text-xs border border-red-500/30 hover:bg-red-500/20 text-red-200 rounded-md px-3 py-1.5"
      >
        Try again
      </button>
    </div>
  );
}
