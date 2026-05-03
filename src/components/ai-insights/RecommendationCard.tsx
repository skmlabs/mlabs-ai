import type { Recommendation, RecommendationPriority } from "@/lib/types/aiInsights";

interface Props {
  rec: Recommendation;
  index: number;
}

const PRIORITY_PILL: Record<RecommendationPriority, string> = {
  high: "bg-red-500/10 text-red-400 border-red-500/25",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  low: "bg-green-500/10 text-green-400 border-green-500/25",
};

export function RecommendationCard({ rec, index }: Props) {
  const pillClass = PRIORITY_PILL[rec.priority] ?? PRIORITY_PILL.medium;
  return (
    <div className="bg-[#13131f] border border-white/5 rounded-lg p-5">
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-sm text-[#9ca3af] flex-shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${pillClass}`}>
              {rec.priority}
            </span>
            <h3 className="text-base font-semibold text-white">{rec.title}</h3>
          </div>
          <p className="text-sm text-[#e5e7eb] leading-relaxed mt-2 mb-3">{rec.rationale}</p>
          <div className="flex items-center gap-4 text-xs text-[#9ca3af] flex-wrap">
            <div>
              Expected outcome: <span className="text-white">{rec.expected_outcome}</span>
            </div>
            <span aria-hidden="true">·</span>
            <div>
              Timeframe: <span className="text-white">{rec.timeframe}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
