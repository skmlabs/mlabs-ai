import { Target } from "lucide-react";
import type { TgMatch, TgMatchStrength } from "@/lib/types/aiInsights";

interface Props {
  tgMatch: TgMatch;
}

const STRENGTH_PILL: Record<TgMatchStrength, string> = {
  Strong: "bg-green-500/10 text-green-400 border-green-500/25",
  Moderate: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  Weak: "bg-red-500/10 text-red-400 border-red-500/25",
};

export function TGMatchCard({ tgMatch }: Props) {
  const pillClass = STRENGTH_PILL[tgMatch.match_strength] ?? STRENGTH_PILL.Moderate;
  return (
    <div className="bg-[#13131f] border border-white/5 rounded-lg p-5">
      <div className="flex items-center gap-2">
        <Target size={18} className="text-[#10b981]" />
        <span className="text-sm font-semibold text-white">TG Match</span>
      </div>
      <div className="mt-2">
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${pillClass}`}>
          {tgMatch.match_strength}
        </span>
      </div>
      <p className="text-sm text-[#e5e7eb] leading-relaxed mt-3 mb-3">{tgMatch.rationale}</p>
      {tgMatch.growth_localities && tgMatch.growth_localities.length > 0 ? (
        <>
          <div className="text-xs uppercase tracking-wider text-[#6b7280] mb-2">Growth Localities</div>
          <div className="flex flex-wrap gap-2">
            {tgMatch.growth_localities.map((loc, i) => (
              <span
                key={i}
                title={loc.rationale}
                className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-xs text-indigo-300"
              >
                {loc.name}
              </span>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
