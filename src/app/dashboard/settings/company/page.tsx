"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Loader2, Plus, X } from "lucide-react";

const PRIMARY_CATEGORIES = [
  "Healthcare", "Education", "Hospitality", "Retail", "Professional Services",
  "Food & Beverage", "Beauty & Wellness", "Automotive", "Real Estate",
  "Veterinary", "Financial Services", "Manufacturing", "Furniture & Home", "Other",
];

const EMPLOYEE_RANGES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

const PRIMARY_GOALS = [
  "More calls",
  "More website visits",
  "More direction requests",
  "Higher ratings",
  "More reviews",
  "Faster review response",
  "Better local SEO",
  "Brand recognition",
  "Customer retention",
  "Cross-sell across locations",
  "Other",
];

const DEFAULT_JOURNEY_STAGES = ["Awareness", "Consideration", "Conversion", "Retention"];

type FormState = {
  brandName: string;
  legalName: string;
  logoUrl: string;
  primaryCategory: string;
  subCategory: string;
  hqCity: string;
  hqCountry: string;
  yearFounded: string;
  employeeCountRange: string;
  website: string;
  supportPhone: string;
  supportEmail: string;
  instagramUrl: string;
  facebookUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  businessDescription: string;
  uniqueSellingProposition: string;
  keyServices: string;
  targetCustomer: string;
  customerJourneyStages: string[];
  primaryGoals: string[];
  competitiveContext: string;
  keyDifferentiators: string;
  growthPriorities: string;
  operationalChallenges: string;
};

const EMPTY_FORM: FormState = {
  brandName: "", legalName: "", logoUrl: "",
  primaryCategory: "", subCategory: "",
  hqCity: "", hqCountry: "IN", yearFounded: "", employeeCountRange: "",
  website: "", supportPhone: "", supportEmail: "",
  instagramUrl: "", facebookUrl: "", linkedinUrl: "", youtubeUrl: "",
  businessDescription: "", uniqueSellingProposition: "", keyServices: "", targetCustomer: "",
  customerJourneyStages: [...DEFAULT_JOURNEY_STAGES],
  primaryGoals: [],
  competitiveContext: "", keyDifferentiators: "", growthPriorities: "", operationalChallenges: "",
};

interface ServerContext {
  brandName?: string; legalName?: string; logoUrl?: string;
  primaryCategory?: string; subCategory?: string;
  hqCity?: string; hqCountry?: string; yearFounded?: number; employeeCountRange?: string;
  website?: string; supportPhone?: string; supportEmail?: string;
  instagramUrl?: string; facebookUrl?: string; linkedinUrl?: string; youtubeUrl?: string;
  businessDescription?: string; uniqueSellingProposition?: string;
  keyServices?: string; targetCustomer?: string;
  customerJourneyStages?: string[]; primaryGoals?: string[];
  competitiveContext?: string; keyDifferentiators?: string;
  growthPriorities?: string; operationalChallenges?: string;
  lastEditedAt?: string;
}

export default function CompanyPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ kind: "success" | "error"; msg: string } | null>(null);
  const [lastEditedAt, setLastEditedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/company-context");
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json() as { context: ServerContext };
      const ctx = j.context ?? {};
      setForm({
        brandName: ctx.brandName ?? "",
        legalName: ctx.legalName ?? "",
        logoUrl: ctx.logoUrl ?? "",
        primaryCategory: ctx.primaryCategory ?? "",
        subCategory: ctx.subCategory ?? "",
        hqCity: ctx.hqCity ?? "",
        hqCountry: ctx.hqCountry ?? "IN",
        yearFounded: typeof ctx.yearFounded === "number" ? String(ctx.yearFounded) : "",
        employeeCountRange: ctx.employeeCountRange ?? "",
        website: ctx.website ?? "",
        supportPhone: ctx.supportPhone ?? "",
        supportEmail: ctx.supportEmail ?? "",
        instagramUrl: ctx.instagramUrl ?? "",
        facebookUrl: ctx.facebookUrl ?? "",
        linkedinUrl: ctx.linkedinUrl ?? "",
        youtubeUrl: ctx.youtubeUrl ?? "",
        businessDescription: ctx.businessDescription ?? "",
        uniqueSellingProposition: ctx.uniqueSellingProposition ?? "",
        keyServices: ctx.keyServices ?? "",
        targetCustomer: ctx.targetCustomer ?? "",
        customerJourneyStages: Array.isArray(ctx.customerJourneyStages) && ctx.customerJourneyStages.length > 0
          ? ctx.customerJourneyStages
          : [...DEFAULT_JOURNEY_STAGES],
        primaryGoals: Array.isArray(ctx.primaryGoals) ? ctx.primaryGoals : [],
        competitiveContext: ctx.competitiveContext ?? "",
        keyDifferentiators: ctx.keyDifferentiators ?? "",
        growthPriorities: ctx.growthPriorities ?? "",
        operationalChallenges: ctx.operationalChallenges ?? "",
      });
      setLastEditedAt(ctx.lastEditedAt ?? null);
    } catch (e) {
      setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Failed to load company context" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-dismiss success banner after 3s; leave errors visible.
  useEffect(() => {
    if (!banner || banner.kind !== "success") return;
    const id = window.setTimeout(() => setBanner(null), 3000);
    return () => window.clearTimeout(id);
  }, [banner]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function updateStage(idx: number, value: string) {
    setForm(prev => ({
      ...prev,
      customerJourneyStages: prev.customerJourneyStages.map((s, i) => i === idx ? value : s),
    }));
  }
  function removeStage(idx: number) {
    setForm(prev => ({
      ...prev,
      customerJourneyStages: prev.customerJourneyStages.filter((_, i) => i !== idx),
    }));
  }
  function addStage() {
    setForm(prev => ({ ...prev, customerJourneyStages: [...prev.customerJourneyStages, ""] }));
  }
  function toggleGoal(goal: string) {
    setForm(prev => ({
      ...prev,
      primaryGoals: prev.primaryGoals.includes(goal)
        ? prev.primaryGoals.filter(g => g !== goal)
        : [...prev.primaryGoals, goal],
    }));
  }

  async function save() {
    if (!form.brandName.trim()) {
      setBanner({ kind: "error", msg: "Brand Name is required." });
      return;
    }
    setSaving(true); setBanner(null);
    try {
      const yearNum = form.yearFounded.trim() ? parseInt(form.yearFounded.trim(), 10) : undefined;
      const stages = form.customerJourneyStages.map(s => s.trim()).filter(Boolean);

      // Send ALL keys (including empty strings) so the helper's strip-empty
      // logic prunes cleared fields out of the stored JSONB.
      const payload: ServerContext = {
        brandName: form.brandName.trim(),
        legalName: form.legalName.trim(),
        logoUrl: form.logoUrl.trim(),
        primaryCategory: form.primaryCategory,
        subCategory: form.subCategory.trim(),
        hqCity: form.hqCity.trim(),
        hqCountry: form.hqCountry.trim(),
        yearFounded: typeof yearNum === "number" && Number.isFinite(yearNum) ? yearNum : undefined,
        employeeCountRange: form.employeeCountRange,
        website: form.website.trim(),
        supportPhone: form.supportPhone.trim(),
        supportEmail: form.supportEmail.trim(),
        instagramUrl: form.instagramUrl.trim(),
        facebookUrl: form.facebookUrl.trim(),
        linkedinUrl: form.linkedinUrl.trim(),
        youtubeUrl: form.youtubeUrl.trim(),
        businessDescription: form.businessDescription.trim(),
        uniqueSellingProposition: form.uniqueSellingProposition.trim(),
        keyServices: form.keyServices.trim(),
        targetCustomer: form.targetCustomer.trim(),
        customerJourneyStages: stages,
        primaryGoals: form.primaryGoals,
        competitiveContext: form.competitiveContext.trim(),
        keyDifferentiators: form.keyDifferentiators.trim(),
        growthPriorities: form.growthPriorities.trim(),
        operationalChallenges: form.operationalChallenges.trim(),
      };

      const res = await fetch("/api/company-context", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json() as { context?: ServerContext; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Save failed");
      setLastEditedAt(j.context?.lastEditedAt ?? new Date().toISOString());
      setBanner({ kind: "success", msg: "Saved." });
    } catch (e) {
      setBanner({ kind: "error", msg: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 text-muted text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading company context…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="space-y-1 mb-6">
        <h1 className="text-2xl font-bold">Company</h1>
        <p className="text-xs text-muted">
          Profile data that fuels AI Insights. Save your changes when ready.
          {lastEditedAt ? ` · Last edited ${new Date(lastEditedAt).toLocaleString()}` : ""}
        </p>
      </div>

      {banner ? (
        <div className={`rounded-lg px-4 py-2.5 text-sm flex items-start gap-2 mb-6 ${
          banner.kind === "success"
            ? "bg-green-500/10 text-green-300 border border-green-500/20"
            : "bg-red-500/10 text-red-300 border border-red-500/20"
        }`}>
          {banner.kind === "success" ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span className="flex-1">{banner.msg}</span>
          <button onClick={() => setBanner(null)} className="text-xs hover:opacity-70"><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      <div className="space-y-6">
        {/* Section 1 — Identity */}
        <Section title="Identity">
          <Grid2>
            <Field label="Brand Name" required>
              <Input value={form.brandName} onChange={v => set("brandName", v)} placeholder="Your business name" />
            </Field>
            <Field label="Legal Name">
              <Input value={form.legalName} onChange={v => set("legalName", v)} placeholder="Optional" />
            </Field>
          </Grid2>
          <Field label="Logo URL">
            <Input value={form.logoUrl} onChange={v => set("logoUrl", v)} placeholder="https://..." />
          </Field>
        </Section>

        {/* Section 2 — Classification */}
        <Section title="Classification">
          <Grid2>
            <Field label="Primary Category">
              <Select value={form.primaryCategory} onChange={v => set("primaryCategory", v)}>
                <option value="">Select…</option>
                {PRIMARY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Sub-category">
              <Input value={form.subCategory} onChange={v => set("subCategory", v)} placeholder="Optional" />
            </Field>
          </Grid2>
        </Section>

        {/* Section 3 — Reach */}
        <Section title="Reach">
          <Grid2>
            <Field label="HQ City">
              <Input value={form.hqCity} onChange={v => set("hqCity", v)} placeholder="e.g. New Delhi" />
            </Field>
            <Field label="Country">
              <Input value={form.hqCountry} onChange={v => set("hqCountry", v)} placeholder="IN" />
            </Field>
            <Field label="Year Founded">
              <Input
                type="number"
                value={form.yearFounded}
                onChange={v => set("yearFounded", v)}
                placeholder="2018"
                min={1900}
                max={2026}
              />
            </Field>
            <Field label="Employee Count Range">
              <Select value={form.employeeCountRange} onChange={v => set("employeeCountRange", v)}>
                <option value="">Select…</option>
                {EMPLOYEE_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
          </Grid2>
        </Section>

        {/* Section 4 — Public presence */}
        <Section title="Public presence">
          <Field label="Website">
            <Input value={form.website} onChange={v => set("website", v)} placeholder="https://example.com" />
          </Field>
          <Grid2>
            <Field label="Customer Support Phone">
              <Input value={form.supportPhone} onChange={v => set("supportPhone", v)} placeholder="+91…" />
            </Field>
            <Field label="Customer Support Email">
              <Input type="email" value={form.supportEmail} onChange={v => set("supportEmail", v)} placeholder="support@…" />
            </Field>
          </Grid2>
          <Grid2>
            <Field label="Instagram URL">
              <Input value={form.instagramUrl} onChange={v => set("instagramUrl", v)} placeholder="https://instagram.com/…" />
            </Field>
            <Field label="Facebook URL">
              <Input value={form.facebookUrl} onChange={v => set("facebookUrl", v)} placeholder="https://facebook.com/…" />
            </Field>
            <Field label="LinkedIn URL">
              <Input value={form.linkedinUrl} onChange={v => set("linkedinUrl", v)} placeholder="https://linkedin.com/…" />
            </Field>
            <Field label="YouTube URL">
              <Input value={form.youtubeUrl} onChange={v => set("youtubeUrl", v)} placeholder="https://youtube.com/…" />
            </Field>
          </Grid2>
        </Section>

        {/* Section 5 — Business context (with AI banner) */}
        <Section title="Business context">
          <div className="bg-brand-indigo/10 border border-brand-indigo/30 rounded-lg px-4 py-3 text-xs">
            This context powers AI Insights. The richer your input, the sharper your insights.
          </div>
          <Field label="Business Description">
            <Textarea
              value={form.businessDescription}
              onChange={v => set("businessDescription", v)}
              placeholder="What does your business do? What problems do you solve? Be specific about offerings."
              rows={4}
            />
          </Field>
          <Field label="Unique Selling Proposition">
            <Textarea
              value={form.uniqueSellingProposition}
              onChange={v => set("uniqueSellingProposition", v)}
              placeholder="What makes you different from competitors? What do customers say about you?"
              rows={3}
            />
          </Field>
          <Field label="Key Services / Products">
            <Textarea
              value={form.keyServices}
              onChange={v => set("keyServices", v)}
              placeholder="List your main services or products. One per line."
              rows={4}
            />
          </Field>
          <Field label="Target Customer">
            <Textarea
              value={form.targetCustomer}
              onChange={v => set("targetCustomer", v)}
              placeholder="Who are your ideal customers? Demographics, behaviors, needs."
              rows={3}
            />
          </Field>

          <Field label="Customer Journey Stages">
            <div className="space-y-2">
              {form.customerJourneyStages.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={s} onChange={v => updateStage(i, v)} placeholder={`Stage ${i + 1}`} />
                  <button
                    type="button"
                    onClick={() => removeStage(i)}
                    className="text-muted hover:text-red-300 p-1"
                    aria-label={`Remove stage ${i + 1}`}
                    title="Remove stage"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addStage}
                className="inline-flex items-center gap-1 text-xs text-brand-indigo hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add stage
              </button>
            </div>
          </Field>

          <Field label="Primary Goals">
            <div className="grid sm:grid-cols-2 gap-2">
              {PRIMARY_GOALS.map(goal => {
                const checked = form.primaryGoals.includes(goal);
                return (
                  <label key={goal} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGoal(goal)}
                      className="accent-brand-indigo"
                    />
                    <span>{goal}</span>
                  </label>
                );
              })}
            </div>
          </Field>
        </Section>

        {/* Section 6 — Strategic context */}
        <Section title="Strategic context">
          <Field label="Competitive Context">
            <Textarea
              value={form.competitiveContext}
              onChange={v => set("competitiveContext", v)}
              placeholder="Who do you consider your main competitors? How do you compare?"
              rows={3}
            />
          </Field>
          <Field label="Key Differentiators">
            <Textarea
              value={form.keyDifferentiators}
              onChange={v => set("keyDifferentiators", v)}
              placeholder="What strengths do you have that competitors don't?"
              rows={3}
            />
          </Field>
          <Field label="Growth Priorities">
            <Textarea
              value={form.growthPriorities}
              onChange={v => set("growthPriorities", v)}
              placeholder="What are you trying to grow this quarter? Locations? Specific services? Markets?"
              rows={3}
            />
          </Field>
          <Field label="Operational Challenges">
            <Textarea
              value={form.operationalChallenges}
              onChange={v => set("operationalChallenges", v)}
              placeholder="What's hardest about running this business at scale? Customer service speed? Multi-location consistency? Local marketing?"
              rows={3}
            />
          </Field>
        </Section>
      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 mt-6 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-bg-card border-t border-bg-border flex items-center justify-end gap-3">
        <button
          onClick={save}
          disabled={saving || !form.brandName.trim()}
          className="bg-brand-indigo hover:bg-indigo-600 px-5 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// --- inline UI primitives -------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-bg-card border border-bg-border rounded-xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-4">{children}</div>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-wider text-muted mb-1.5">
        {label}{required ? <span className="text-red-400 ml-0.5">*</span> : null}
      </div>
      {children}
    </label>
  );
}

function Input({
  value, onChange, placeholder, type = "text", min, max,
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; min?: number; max?: number }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      className="w-full bg-bg border border-bg-border rounded-md px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:border-brand-indigo"
    />
  );
}

function Textarea({
  value, onChange, placeholder, rows = 3,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-bg border border-bg-border rounded-md px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:border-brand-indigo resize-y"
    />
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-bg border border-bg-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-indigo"
    >
      {children}
    </select>
  );
}
