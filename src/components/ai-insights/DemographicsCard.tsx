import { Users } from "lucide-react";
import type { Demographics } from "@/lib/types/aiInsights";

interface Props {
  demographics: Demographics;
}

export function DemographicsCard({ demographics }: Props) {
  return (
    <div className="bg-[#13131f] border border-white/5 rounded-lg p-5">
      <div className="flex items-center gap-2">
        <Users size={18} className="text-[#6366f1]" />
        <span className="text-sm font-semibold text-white">Demographics</span>
      </div>
      <div className="text-xl font-bold text-white mt-3 mb-3">
        {demographics.estimated_households_in_catchment}
      </div>
      <div className="text-xs text-[#9ca3af] mb-2">{demographics.primary_demographics}</div>
      <p className="text-sm text-[#e5e7eb] leading-relaxed">{demographics.summary}</p>
    </div>
  );
}
