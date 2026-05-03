import type { Recommendation, RecommendationPriority } from "@/lib/types/aiInsights";
import { RecommendationCard } from "./RecommendationCard";

interface Props {
  recommendations: Recommendation[];
}

const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function RecommendationsList({ recommendations }: Props) {
  // Sort high → medium → low. Stable on ties (preserves Gemini's ordering
  // within a priority bucket).
  const sorted = [...recommendations].sort(
    (a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1),
  );
  return (
    <div className="space-y-3">
      {sorted.map((rec, i) => (
        <RecommendationCard key={i} rec={rec} index={i} />
      ))}
    </div>
  );
}
