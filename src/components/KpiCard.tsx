export type KpiAccent = "indigo" | "amber" | "emerald";

interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  onClick?: () => void;
  selected?: boolean;
  dimmed?: boolean;
  accent?: KpiAccent;
}

const ACCENT_RING: Record<KpiAccent, string> = {
  indigo: "border-brand-indigo ring-2 ring-brand-indigo/30",
  amber: "border-brand-amber ring-2 ring-brand-amber/30",
  emerald: "border-emerald-400 ring-2 ring-emerald-400/30",
};

const ACCENT_HOVER: Record<KpiAccent, string> = {
  indigo: "hover:border-brand-indigo/50",
  amber: "hover:border-brand-amber/50",
  emerald: "hover:border-emerald-400/50",
};

export function KpiCard({ label, value, sub, onClick, selected, dimmed, accent = "indigo" }: KpiCardProps) {
  const base = "bg-bg-card border rounded-xl p-4 transition-all text-left block w-full";
  const stateClass = selected
    ? ACCENT_RING[accent]
    : dimmed
    ? `border-bg-border opacity-40 ${onClick ? "hover:opacity-70" : ""}`
    : `border-bg-border ${onClick ? ACCENT_HOVER[accent] : ""}`;

  const body = (
    <>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-3xl font-bold mt-1 text-white">{value}</div>
      {sub ? <div className="text-xs text-muted mt-1">{sub}</div> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={!!selected} className={`${base} ${stateClass}`}>
        {body}
      </button>
    );
  }
  return <div className={`${base} ${stateClass}`}>{body}</div>;
}
