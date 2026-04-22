"use client";
import type { DateRangeKey } from "@/lib/dateRange";

const OPTS: { key: DateRangeKey; label: string }[] = [
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "7 days" },
  { key: "28d", label: "28 days" },
  { key: "90d", label: "90 days" },
];

export function DateRangePills({ value, onChange }: { value: DateRangeKey; onChange: (k: DateRangeKey) => void }) {
  return (
    <div className="inline-flex bg-bg-card border border-bg-border rounded-lg p-1 text-xs">
      {OPTS.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1.5 rounded-md transition ${value === o.key ? "bg-brand-indigo text-white" : "text-muted hover:text-white"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
