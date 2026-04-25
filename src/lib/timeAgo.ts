// Human-friendly relative time. Used for "Last synced…" labels.
// "just now" up to 60s, "5 min ago" up to 60m, "2 hours ago" up to 24h,
// "Yesterday" within ~48h, then "April 24" for older dates within the same year,
// and "April 24, 2025" if not the current year.
export function timeAgo(input: string | Date | null | undefined, now: Date = new Date()): string {
  if (!input) return "never";
  const d = typeof input === "string" ? new Date(input) : input;
  if (isNaN(d.getTime())) return "never";

  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return "just now";

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;

  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day} days ago`;

  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, sameYear
    ? { month: "long", day: "numeric" }
    : { month: "long", day: "numeric", year: "numeric" });
}

// Compact TAT label: "2h 14m" / "3.4 days" / "12 min" / "—"
export function formatTatSeconds(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${Math.round(seconds)} sec`;

  const min = seconds / 60;
  if (min < 60) return `${Math.round(min)} min`;

  const hr = min / 60;
  if (hr < 24) {
    const h = Math.floor(hr);
    const m = Math.round(min - h * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  const days = hr / 24;
  if (days < 10) return `${days.toFixed(1)} days`;
  return `${Math.round(days)} days`;
}
