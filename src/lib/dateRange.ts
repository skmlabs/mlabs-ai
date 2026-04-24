export type DateRangeKey = "7d" | "28d" | "90d" | "custom";

export interface CustomRange { start: string; end: string }

// GMB Performance API has a 24-48h data lag, so a "yesterday" view is always
// empty or misleading. Accepts legacy values and normalizes them to "7d".
export function normalizeRangeKey(s: string | null | undefined): DateRangeKey {
  if (s === "7d" || s === "28d" || s === "90d" || s === "custom") return s;
  return "7d";
}

export function getDateRange(key: DateRangeKey, custom?: CustomRange): { start: Date; end: Date; label: string } {
  if (key === "custom" && custom) {
    const start = parseYMDToUTC(custom.start);
    const end = parseYMDToUTC(custom.end);
    return { start, end, label: `${custom.start} to ${custom.end}` };
  }

  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  // GMB Perf API lags ~2-3 days, so "end" is yesterday
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  switch (key) {
    case "7d": start.setUTCDate(end.getUTCDate() - 6); break;
    case "28d": start.setUTCDate(end.getUTCDate() - 27); break;
    case "90d": start.setUTCDate(end.getUTCDate() - 89); break;
    case "custom":
      // missing custom object; fall back to 28d window
      start.setUTCDate(end.getUTCDate() - 27);
      break;
  }
  return { start, end, label: humanLabel(key) };
}

function humanLabel(k: DateRangeKey): string {
  switch (k) {
    case "7d": return "Last 7 days";
    case "28d": return "Last 28 days";
    case "90d": return "Last 90 days";
    case "custom": return "Custom range";
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

export function parseYMDToUTC(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  return dt;
}

export function isValidYMD(s: string | null | undefined): s is string {
  if (!s) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parseYMDToUTC(s);
  return !isNaN(d.getTime());
}
