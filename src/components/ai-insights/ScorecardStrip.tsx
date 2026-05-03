import type { Scorecard } from "@/lib/types/aiInsights";
import { ScoreCard } from "./ScoreCard";

interface Props {
  scorecard: Scorecard;
}

// Renders the 5 scorecard cards in the documented order:
// rating → reviews → velocity → competitive_position → sentiment.
// Grid collapses to 2 cols on mobile, 3 at md, 5 at lg.
export function ScorecardStrip({ scorecard }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <ScoreCard {...scorecard.rating} />
      <ScoreCard {...scorecard.reviews} />
      <ScoreCard {...scorecard.velocity} />
      <ScoreCard {...scorecard.competitive_position} />
      <ScoreCard {...scorecard.sentiment} />
    </div>
  );
}
