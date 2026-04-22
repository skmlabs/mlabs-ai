export type DateRangeKey = "yesterday" | "7d" | "28d" | "90d";

export function getDateRange(key: DateRangeKey): { start: Date; end: Date; label: string } {
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  // GMB Perf API lags ~2-3 days, so "end" is yesterday
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  switch (key) {
    case "yesterday": start.setUTCDate(end.getUTCDate()); break;
    case "7d": start.setUTCDate(end.getUTCDate() - 6); break;
    case "28d": start.setUTCDate(end.getUTCDate() - 27); break;
    case "90d": start.setUTCDate(end.getUTCDate() - 89); break;
  }
  return { start, end, label: humanLabel(key) };
}

function humanLabel(k: DateRangeKey): string {
  switch (k) {
    case "yesterday": return "Yesterday";
    case "7d": return "Last 7 days";
    case "28d": return "Last 28 days";
    case "90d": return "Last 90 days";
  }
}

export function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function eachDay(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(start);
  while (d <= end) { out.push(new Date(d)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}
