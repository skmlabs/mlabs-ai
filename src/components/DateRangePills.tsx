"use client";
import { useState } from "react";
import type { DateRangeKey } from "@/lib/dateRange";
import { CustomDateRangePicker } from "./CustomDateRangePicker";
import { Calendar } from "lucide-react";

const OPTS: { key: DateRangeKey; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "28d", label: "28 days" },
  { key: "90d", label: "90 days" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_6_months", label: "Last 6 months" },
];

interface Props {
  value: DateRangeKey;
  onChange: (k: DateRangeKey) => void;
  onCustomApply?: (start: string, end: string) => void;
  customStart?: string;
  customEnd?: string;
}

export function DateRangePills({ value, onChange, onCustomApply, customStart, customEnd }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const customActive = value === "custom";

  return (
    <div className="relative inline-flex flex-wrap bg-bg-card border border-bg-border rounded-lg p-1 text-xs gap-0.5">
      {OPTS.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1.5 rounded-md transition whitespace-nowrap ${value === o.key ? "bg-brand-indigo text-white" : "text-muted hover:text-white"}`}
        >
          {o.label}
        </button>
      ))}
      <button
        onClick={() => setPickerOpen(v => !v)}
        className={`px-3 py-1.5 rounded-md transition inline-flex items-center gap-1 whitespace-nowrap ${customActive ? "bg-brand-indigo text-white" : "text-muted hover:text-white"}`}
        title={customActive && customStart && customEnd ? `${customStart} to ${customEnd}` : "Pick a custom range"}
      >
        <Calendar className="h-3 w-3" />
        {customActive && customStart && customEnd ? `${customStart} → ${customEnd}` : "Custom"}
      </button>
      {onCustomApply ? (
        <CustomDateRangePicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onApply={onCustomApply}
          initialStart={customStart}
          initialEnd={customEnd}
        />
      ) : null}
    </div>
  );
}
