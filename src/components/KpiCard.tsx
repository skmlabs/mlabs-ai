export function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-3xl font-bold mt-1 text-white">{value}</div>
      {sub ? <div className="text-xs text-muted mt-1">{sub}</div> : null}
    </div>
  );
}
