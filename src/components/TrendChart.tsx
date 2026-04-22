"use client";
type Point = { date: string; calls: number; directions: number; website: number };

export function TrendChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <div className="bg-bg-card border border-bg-border rounded-xl p-6 h-[260px] flex items-center justify-center text-muted text-sm">No trend data for this range.</div>;
  }
  const w = 760, h = 220, pad = 28;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  const maxY = Math.max(1, ...data.map(d => Math.max(d.calls, d.directions, d.website)));
  const x = (i: number) => pad + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad + innerH - (v / maxY) * innerH;
  function path(key: keyof Point) {
    return data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key] as number)}`).join(" ");
  }
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium">Daily trend</div>
        <div className="flex gap-3 text-[11px]">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-brand-indigo" /> Calls</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-brand-amber" /> Directions</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-400" /> Website</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
        <path d={path("calls")} stroke="#6366f1" strokeWidth="2" fill="none" />
        <path d={path("directions")} stroke="#f59e0b" strokeWidth="2" fill="none" />
        <path d={path("website")} stroke="#4ade80" strokeWidth="2" fill="none" />
      </svg>
    </div>
  );
}
