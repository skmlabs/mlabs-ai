import { Wallet } from "lucide-react";
import type { AffluenceTier, HouseholdAffluence } from "@/lib/types/aiInsights";

interface Props {
  affluence: HouseholdAffluence;
}

const TIER_PILL: Record<AffluenceTier, string> = {
  "Affluent": "bg-indigo-500/10 text-indigo-300 border-indigo-500/25",
  "Upper middle": "bg-indigo-500/10 text-indigo-300 border-indigo-500/25",
  "Middle": "bg-amber-500/10 text-amber-400 border-amber-500/25",
  "Mixed": "bg-amber-500/10 text-amber-400 border-amber-500/25",
  "Lower middle": "bg-white/5 text-[#9ca3af] border-white/10",
};

export function AffluenceCard({ affluence }: Props) {
  const pillClass = TIER_PILL[affluence.tier] ?? TIER_PILL["Mixed"];
  return (
    <div className="bg-[#13131f] border border-white/5 rounded-lg p-5">
      <div className="flex items-center gap-2">
        <Wallet size={18} className="text-[#f59e0b]" />
        <span className="text-sm font-semibold text-white">Household Affluence</span>
      </div>
      <div className="mt-2">
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${pillClass}`}>
          {affluence.tier}
        </span>
      </div>
      <div className="text-xl font-bold text-white mt-3 mb-3">
        {affluence.estimated_relevant_tg_households}
      </div>
      <div className="text-xs text-[#9ca3af] mb-2">{affluence.indicators}</div>
      <p className="text-sm text-[#e5e7eb] leading-relaxed">{affluence.summary}</p>
    </div>
  );
}
