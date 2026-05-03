"use client";

import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";
import type { CompetitiveBar } from "@/lib/types/aiInsights";

interface Props {
  bars: CompetitiveBar[];
}

const TOOLTIP_STYLE = {
  backgroundColor: "#13131f",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "white",
};

const LEGEND_STYLE = { fontSize: 12, color: "#9ca3af" };

export function CompetitiveBars({ bars }: Props) {
  return (
    <div className="bg-[#13131f] border border-white/5 rounded-lg p-5">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={bars} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f1f2e" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="competitor"
            stroke="#6b7280"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke="#6366f1"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={[0, 5]}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#f59e0b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Bar yAxisId="left" dataKey="rating" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar yAxisId="right" dataKey="total_reviews" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
