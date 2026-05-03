import { TrendingUp } from "lucide-react";
import type { MarketLeader } from "@/lib/types/aiInsights";

interface Props {
  leaders: MarketLeader[];
}

export function MarketLeadersCard({ leaders }: Props) {
  return (
    <div className="bg-[#13131f] border border-white/5 rounded-lg p-5">
      <div className="flex items-center gap-2">
        <TrendingUp size={18} className="text-[#6366f1]" />
        <span className="text-sm font-semibold text-white">Market Leaders</span>
      </div>
      {leaders && leaders.length > 0 ? (
        <ul className="mt-3 space-y-3">
          {leaders.map((leader, i) => (
            <li key={i}>
              <div className="text-sm font-medium text-white">{leader.name}</div>
              <div className="text-xs text-[#6b7280]">{leader.category}</div>
              <p className="text-xs text-[#e5e7eb] mt-1 leading-relaxed">{leader.relevance}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#9ca3af] italic mt-3">No market leaders identified.</p>
      )}
    </div>
  );
}
