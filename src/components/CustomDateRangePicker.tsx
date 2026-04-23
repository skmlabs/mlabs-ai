"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { format, subYears } from "date-fns";

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (start: string, end: string) => void;
  initialStart?: string;
  initialEnd?: string;
}

function parseYMD(s: string | undefined): Date | undefined {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(Date.UTC(y, m - 1, d));
}

export function CustomDateRangePicker({ open, onClose, onApply, initialStart, initialEnd }: Props) {
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = parseYMD(initialStart);
    const to = parseYMD(initialEnd);
    return from && to ? { from, to } : undefined;
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open, onClose]);

  if (!open) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // GMB perf API lags, so disable today and later
  const minDate = subYears(today, 2);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() - 1);

  function apply() {
    if (!range?.from || !range?.to) return;
    onApply(format(range.from, "yyyy-MM-dd"), format(range.to, "yyyy-MM-dd"));
    onClose();
  }

  const applyDisabled = !range?.from || !range?.to;

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-[calc(100%+4px)] z-40 bg-bg-card border border-bg-border rounded-xl shadow-2xl p-4"
    >
      <DayPicker
        mode="range"
        selected={range}
        onSelect={setRange}
        numberOfMonths={2}
        disabled={{ before: minDate, after: maxDate }}
        showOutsideDays
      />
      <div className="flex items-center justify-between mt-2 pt-3 border-t border-bg-border gap-2">
        <div className="text-xs text-muted">
          {range?.from ? format(range.from, "MMM d, yyyy") : "Start"}
          {" → "}
          {range?.to ? format(range.to, "MMM d, yyyy") : "End"}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="text-xs border border-bg-border hover:border-muted rounded-md px-3 py-1.5 text-muted hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            disabled={applyDisabled}
            className="text-xs bg-brand-indigo hover:bg-indigo-600 rounded-md px-3 py-1.5 text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
