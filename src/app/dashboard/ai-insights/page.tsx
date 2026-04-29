"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Download, Loader2, RefreshCw, Sparkles, X } from "lucide-react";

interface InsightsResponse {
  insights?: string;
  cached?: boolean;
  error?: string;
  regenerateLockedUntilHours?: number;
  retryAfter?: number;
}

interface Section {
  id: string;
  title: string;
}

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

// Pull h2 titles out of the raw markdown so we can render the side nav and
// anchor links without parsing the whole tree twice.
function extractSections(markdown: string): Section[] {
  const out: Section[] = [];
  const seen = new Set<string>();
  for (const line of markdown.split("\n")) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (!m) continue;
    const title = m[1] ?? "";
    if (!title) continue;
    let id = slugify(title);
    let suffix = 1;
    while (seen.has(id)) {
      suffix++;
      id = `${slugify(title)}-${suffix}`;
    }
    seen.add(id);
    out.push({ id, title });
  }
  return out;
}

export default function AiInsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerateBanner, setRegenerateBanner] = useState<string | null>(null);
  const [regenerateLockedHours, setRegenerateLockedHours] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async (force: boolean) => {
    if (force) setRegenerating(true); else setLoading(true);
    setError(null);
    if (force) setRegenerateBanner(null);
    try {
      const res = await fetch(`/api/ai-insights${force ? "?force=1" : ""}`, { cache: "no-store" });
      const j = await res.json() as InsightsResponse;

      // Cooldown gate (HTTP 429) — keep the cached insights visible and surface
      // the message as a non-blocking banner. Without this branch the user
      // would see a full-page error after clicking Regenerate during cooldown.
      if (res.status === 429) {
        const msg = j.error ?? "AI Insights can be regenerated once every 24 hours.";
        setRegenerateBanner(msg);
        if (typeof j.regenerateLockedUntilHours === "number") {
          setRegenerateLockedHours(j.regenerateLockedUntilHours);
        }
        return;
      }

      if (!res.ok) throw new Error(j.error ?? `Request failed: ${res.status}`);
      setData(j);
      // Successful regen clears any stale cooldown state.
      setRegenerateLockedHours(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load insights");
    } finally {
      if (force) setRegenerating(false); else setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  // Auto-dismiss the cooldown banner after 6s. The Regenerate button stays
  // disabled (via regenerateLockedDays) so the user still sees the constraint
  // even after the toast fades.
  useEffect(() => {
    if (!regenerateBanner) return;
    const id = window.setTimeout(() => setRegenerateBanner(null), 6000);
    return () => window.clearTimeout(id);
  }, [regenerateBanner]);

  const sections = useMemo(
    () => data?.insights ? extractSections(data.insights) : [],
    [data?.insights],
  );

  // Active section highlighting — IntersectionObserver on rendered h2s. We
  // re-create the observer whenever the rendered content (and therefore the
  // h2 nodes) changes.
  useEffect(() => {
    if (!data?.insights || !contentRef.current) return;
    const headings = Array.from(contentRef.current.querySelectorAll<HTMLHeadingElement>("h2[id]"));
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
    if (!activeSection && headings[0]) setActiveSection(headings[0].id);
    return () => observer.disconnect();
  // intentionally re-runs when insights change so observer points at new nodes
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
            border: none !important;
          }
          .ai-insights-content h1,
          .ai-insights-content h2,
          .ai-insights-content h3,
          .ai-insights-content strong { color: black !important; }
          .ai-insights-content p,
          .ai-insights-content li { color: #1f2937 !important; }
          .ai-insights-content a { color: #1f2937 !important; text-decoration: underline; }
        }
      `}</style>

      {/* Header */}
      <div className="ai-insights-no-print flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-indigo" /> AI Insights
          </h1>
          <p className="text-xs text-muted mt-1">
            {data?.cached ? "Cached · regenerate to refresh" : data && !data.cached ? "Fresh" : " "}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadAsPdf}
            disabled={!data?.insights}
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

      {/* Cooldown banner — non-blocking; keeps cached content visible. */}
      {regenerateBanner ? (
        <div className="ai-insights-no-print bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-2.5 text-sm text-amber-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{regenerateBanner}</span>
          <button onClick={() => setRegenerateBanner(null)} className="text-xs hover:opacity-70" aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* States */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={() => load(false)} />
      ) : !data?.insights ? (
        <ErrorState error="No insights returned." onRetry={() => load(true)} />
      ) : (
        <div className="grid lg:grid-cols-[200px_minmax(0,1fr)] gap-6">
          {/* Sticky section nav (desktop only) */}
          <aside className="ai-insights-no-print hidden lg:block">
            <nav className="sticky top-4 space-y-1 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-muted mb-2">Sections</div>
              {sections.map(s => {
                const isActive = s.id === activeSection;
                return (
                  <button
                    key={s.id}
                    onClick={() => scrollToSection(s.id)}
                    className={`block w-full text-left px-2 py-1.5 rounded transition ${
                      isActive ? "bg-brand-indigo/15 text-white border-l-2 border-brand-indigo pl-1.5" : "text-muted hover:text-white"
                    }`}
                  >
                    {s.title}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Markdown content */}
          <div
            ref={contentRef}
            className="ai-insights-content bg-bg-card border border-bg-border rounded-xl p-6 md:p-8 max-w-none"
          >
            {regenerating ? (
              <div className="text-xs text-muted mb-4 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Regenerating in the background — current view shown until ready.
              </div>
            ) : null}
            <Markdown source={data.insights} sectionIds={sections} />
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-8 flex items-start gap-4">
      <Loader2 className="h-5 w-5 text-brand-indigo animate-spin mt-0.5 shrink-0" />
      <div>
        <div className="text-sm font-medium">Analyzing your locations and competitors…</div>
        <div className="text-xs text-muted mt-1">
          Gemini 2.5 Pro is generating a fresh brief. This usually takes 20-40 seconds.
          Subsequent loads are cached and instant.
        </div>
      </div>
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

// ----- Minimal markdown renderer ------------------------------------------
//
// Handles the subset Gemini emits per our prompt: h1/h2/h3, **bold**, *italic*,
// `code`, bulleted lists (- ...), numbered lists (1. ...), paragraphs.
// h2 ids are matched to extractSections() so the nav anchors line up.

function Markdown({ source, sectionIds }: { source: string; sectionIds: Section[] }) {
  const blocks = parseBlocks(source);
  let h2Cursor = 0;
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        if (b.type === "h1") return <h1 key={i} className="text-2xl font-bold text-white mt-6 first:mt-0">{renderInline(b.text)}</h1>;
        if (b.type === "h2") {
          const id = sectionIds[h2Cursor]?.id ?? slugify(b.text);
          h2Cursor++;
          return (
            <h2 key={i} id={id} className="text-xl font-semibold text-white mt-8 first:mt-0 scroll-mt-20 border-b border-bg-border pb-2">
              {renderInline(b.text)}
            </h2>
          );
        }
        if (b.type === "h3") return <h3 key={i} className="text-base font-semibold text-white mt-4">{renderInline(b.text)}</h3>;
        if (b.type === "ul") {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1.5 text-sm text-white/90">
              {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
            </ul>
          );
        }
        if (b.type === "ol") {
          return (
            <ol key={i} className="list-decimal pl-5 space-y-1.5 text-sm text-white/90">
              {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
            </ol>
          );
        }
        return <p key={i} className="text-sm text-white/90 leading-relaxed">{renderInline(b.text)}</p>;
      })}
    </div>
  );
}

type Block =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "p"; text: string };

function parseBlocks(md: string): Block[] {
  // Split into "blocks" by blank lines, but lists span consecutive lines so we
  // assemble them by walking line-by-line within each chunk.
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i] ?? "";
    const line = raw.trim();

    if (line === "") { i++; continue; }

    let m: RegExpExecArray | null;

    if ((m = /^###\s+(.+)$/.exec(line))) {
      blocks.push({ type: "h3", text: m[1] ?? "" }); i++; continue;
    }
    if ((m = /^##\s+(.+)$/.exec(line))) {
      blocks.push({ type: "h2", text: m[1] ?? "" }); i++; continue;
    }
    if ((m = /^#\s+(.+)$/.exec(line))) {
      blocks.push({ type: "h1", text: m[1] ?? "" }); i++; continue;
    }

    // Bullet list — consume consecutive `- ` or `* ` lines.
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = (lines[i] ?? "").trim();
        const lm = /^[-*]\s+(.+)$/.exec(t);
        if (!lm) break;
        items.push(lm[1] ?? "");
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Numbered list — consume consecutive `N. ` lines.
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length) {
        const t = (lines[i] ?? "").trim();
        const lm = /^\d+\.\s+(.+)$/.exec(t);
        if (!lm) break;
        items.push(lm[1] ?? "");
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Paragraph — gather until blank line or new block-level token.
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const t = (lines[i] ?? "").trim();
      if (t === "") break;
      if (/^(#{1,3}\s+|[-*]\s+|\d+\.\s+)/.test(t)) break;
      paraLines.push(t);
      i++;
    }
    blocks.push({ type: "p", text: paraLines.join(" ") });
  }

  return blocks;
}

// Inline renderer for **bold**, *italic*, and `code`. Returns React nodes so
// we don't have to dangerouslySetInnerHTML.
function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Order matters: bold (**...**) before italic (*...*) so we don't eat the
  // outer asterisks of a bold span as italic.
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) out.push(text.slice(lastIndex, m.index));
    const tok = m[0];
    if (tok.startsWith("**") && tok.endsWith("**")) {
      out.push(<strong key={key++} className="text-white font-semibold">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`") && tok.endsWith("`")) {
      out.push(<code key={key++} className="bg-bg px-1 py-0.5 rounded text-[0.85em]">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("*") && tok.endsWith("*")) {
      out.push(<em key={key++}>{tok.slice(1, -1)}</em>);
    }
    lastIndex = m.index + tok.length;
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex));
  return out;
}
