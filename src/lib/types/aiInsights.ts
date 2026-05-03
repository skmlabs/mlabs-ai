// Wire format returned by /api/ai-insights for the v2 structured-output
// pipeline. Property names match the JSON schema in src/lib/ai/insightsPrompt.ts
// verbatim (snake_case) so we can JSON.parse Gemini's response straight into
// AIInsightsResponse with no transform step. Phase 2 UI components import the
// child interfaces from here.

export type StatusFlag = "green" | "yellow" | "red";

export type ThemeSentiment = "positive" | "mixed" | "negative";

export type RecommendationPriority = "high" | "medium" | "low";

export type TgMatchStrength = "Strong" | "Moderate" | "Weak";

// Exactly as instructed in the prompt — preserves capitalization Gemini is
// asked to emit so equality checks line up.
export type AffluenceTier =
  | "Lower middle"
  | "Middle"
  | "Upper middle"
  | "Affluent"
  | "Mixed";

// One scorecard tile (5 of these in scorecard).
export interface ScorecardCard {
  value: string;
  label: string;
  context: string;
  status: StatusFlag;
}

export interface Scorecard {
  rating: ScorecardCard;
  reviews: ScorecardCard;
  velocity: ScorecardCard;
  competitive_position: ScorecardCard;
  sentiment: ScorecardCard;
}

export interface ThemeEvidence {
  reviewer: string;
  quote: string;
}

export interface Theme {
  name: string;
  sentiment: ThemeSentiment;
  frequency: string;
  description: string;
  evidence: ThemeEvidence[];
}

export interface CompetitiveComparisonRow {
  label: string;
  values: string[];
}

export interface CompetitiveComparison {
  headers: string[];
  rows: CompetitiveComparisonRow[];
  analysis: string;
}

export interface Demographics {
  primary_demographics: string;
  estimated_households_in_catchment: string;
  summary: string;
}

export interface HouseholdAffluence {
  tier: AffluenceTier;
  indicators: string;
  estimated_relevant_tg_households: string;
  summary: string;
}

export interface MarketLeader {
  name: string;
  category: string;
  relevance: string;
}

export interface GrowthLocality {
  name: string;
  rationale: string;
}

export interface TgMatch {
  match_strength: TgMatchStrength;
  rationale: string;
  growth_localities: GrowthLocality[];
}

export interface CatchmentIntelligence {
  geographic_summary: string;
  demographics: Demographics;
  household_affluence: HouseholdAffluence;
  market_leaders: MarketLeader[];
  tg_match: TgMatch;
}

export interface Recommendation {
  title: string;
  rationale: string;
  expected_outcome: string;
  priority: RecommendationPriority;
  timeframe: string;
}

export interface ReviewVelocityPoint {
  period: string;
  count: number;
}

export interface CompetitiveBar {
  competitor: string;
  rating: number;
  total_reviews: number;
}

export interface ThemeFrequencyPoint {
  theme: string;
  count: number;
  sentiment: ThemeSentiment;
}

// All four sub-arrays are required (validation in route.ts checks this).
// chart_findings is plain-English captions tied to the velocity chart.
export interface ChartData {
  review_velocity_90d: ReviewVelocityPoint[];
  competitive_bars: CompetitiveBar[];
  theme_frequency: ThemeFrequencyPoint[];
  chart_findings: string[];
}

// Top-level response. Validation in src/app/api/ai-insights/route.ts checks:
//   - all 8 top-level keys present
//   - scorecard has all 5 sub-keys
//   - themes is non-empty array
//   - recommendations is non-empty array
//   - competitive_comparison.rows.length === 5
//   - chart_data is an object with all 4 sub-arrays present
export interface AIInsightsResponse {
  scorecard: Scorecard;
  executive_summary: string;
  themes: Theme[];
  sentiment_trend: string;
  competitive_comparison: CompetitiveComparison;
  catchment_intelligence: CatchmentIntelligence;
  recommendations: Recommendation[];
  chart_data: ChartData;
}
