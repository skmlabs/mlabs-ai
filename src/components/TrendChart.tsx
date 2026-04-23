"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { parseISO, format, startOfWeek, startOfMonth } from "date-fns";

type Point = { date: string; calls: number; directions: number; website: number };
type Granularity = "daily" | "weekly" | "monthly";

const COLORS = {
  calls: "#6366f1",
  directions: "#f59e0b",
  website: "#4ade80",
} as const;

function aggregate(data: Point[], gran: Granularity): Point[] {
  if (gran === "daily" || data.length === 0) return data;
  const bucket = new Map<string, Point>();
  for (const p of data) {
    const d = parseISO(p.date);
    const key = gran === "weekly"
      ? format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd")
      : format(startOfMonth(d), "yyyy-MM-dd");
    const prev = bucket.get(key);
    if (prev) {
      prev.calls += p.calls;
      prev.directions += p.directions;
      prev.website += p.website;
    } else {
      bucket.set(key, { date: key, calls: p.calls, directions: p.directions, website: p.website });
    }
  }
  return Array.from(bucket.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function formatXAxis(dateStr: string, gran: Granularity): string {
  const d = parseISO(dateStr);
  if (gran === "monthly") return format(d, "MMM yy");
  if (gran === "weekly") return format(d, "MMM d");
  return format(d, "MMM d");
}

function formatTooltipLabel(dateStr: string, gran: Granularity): string {
  const d = parseISO(dateStr);
  if (gran === "monthly") return format(d, "MMMM yyyy");
  if (gran === "weekly") return `Week of ${format(d, "MMM d, yyyy")}`;
  return format(d, "EEE, MMM d, yyyy");
}

function CustomTooltip({ active, payload, label, gran }: TooltipContentProps & { gran: Granularity }) {
  if (!active || !payload || payload.length === 0 || typeof label !== "string") return null;
  return (
    <div className="bg-bg-card border border-bg-border rounded-lg p-3 shadow-xl text-xs">
      <div className="font-medium mb-2 text-white">{formatTooltipLabel(label, gran)}</div>
      <div className="space-y-1">
        {payload.map(entry => {
          const val = typeof entry.value === "number" ? entry.value : Number(entry.value ?? 0);
          return (
            <div key={String(entry.dataKey)} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted capitalize">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: entry.color }} />
                {String(entry.name ?? "")}
              </span>
              <span className="text-white font-medium">{val.toLocaleString()}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const GRAN_OPTS: { key: Granularity; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

export function TrendChart({ data }: { data: Point[] }) {
  const [gran, setGran] = useState<Granularity>("daily");
  const series = useMemo(() => aggregate(data, gran), [data, gran]);

  if (data.length === 0) {
    return (
      <div className="bg-bg-card border border-bg-border rounded-xl p-6 h-[300px] flex items-center justify-center text-muted text-sm">
        No trend data for this range.
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-sm font-medium">Trend</div>
        <div className="inline-flex bg-bg border border-bg-border rounded-lg p-1 text-[11px]">
          {GRAN_OPTS.map(o => (
            <button
              key={o.key}
              onClick={() => setGran(o.key)}
              className={`px-2.5 py-1 rounded-md transition ${gran === o.key ? "bg-brand-indigo text-white" : "text-muted hover:text-white"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={series} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#1f2230" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fill: "#8a8fa0", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#1f2230" }}
              tickFormatter={d => formatXAxis(d, gran)}
              minTickGap={20}
            />
            <YAxis
              tick={{ fill: "#8a8fa0", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#1f2230" }}
              width={40}
            />
            <Tooltip
              cursor={{ stroke: "#6366f1", strokeOpacity: 0.3 }}
              content={props => <CustomTooltip {...props} gran={gran} />}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={v => <span style={{ color: "#8a8fa0", textTransform: "capitalize" }}>{v}</span>}
            />
            <Line type="monotone" dataKey="calls" name="Calls" stroke={COLORS.calls} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="directions" name="Directions" stroke={COLORS.directions} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="website" name="Website" stroke={COLORS.website} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
