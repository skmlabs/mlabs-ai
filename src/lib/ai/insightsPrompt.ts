import type { InsightsContext } from "./buildInsightsContext";

// Competitive-intelligence v2 prompt — JSON output. Same data-injection
// variables as the prior version (companyHeader, locationsBlock with relative
// timestamps, competitorsBlock). Now instructs Gemini to return ONE JSON
// object matching the AIInsightsResponse schema (see
// src/lib/types/aiInsights.ts) — no prose, no markdown code fences.
// Validation lives in src/app/api/ai-insights/route.ts.
export function buildInsightsPrompt(ctx: InsightsContext): string {
  const cc = ctx.companyContext ?? {};
  const businessName = cc.brandName ?? "this business";
  const now = new Date();

  const companyHeader = [
    `- Brand: ${cc.brandName ?? "Unknown"}`,
    `- Category: ${cc.primaryCategory ?? "Unknown"}${cc.subCategory ? " > " + cc.subCategory : ""}`,
    `- HQ: ${cc.hqCity ?? "Unknown"}, ${cc.hqCountry ?? "IN"}`,
    cc.yearFounded ? `- Founded: ${cc.yearFounded}` : null,
    cc.employeeCountRange ? `- Team size: ${cc.employeeCountRange}` : null,
    cc.website ? `- Website: ${cc.website}` : null,
  ].filter(Boolean).join("\n");

  const locationsBlock = ctx.locations.map((loc, i) => {
    const reviewsBlock = loc.recentReviews.length > 0
      ? `\n### 5 Most Recent Reviews\n${loc.recentReviews.map((r, j) => {
          const author = r.authorName ? `${r.authorName} ` : "";
          const when = r.publishTime ? `(${relativeTime(r.publishTime, now)}) ` : "";
          const truncated = (r.text || "").length > 400;
          const text = (r.text || "").slice(0, 400);
          return `${j + 1}. [${r.rating}★] ${author}${when}— ${text}${truncated ? "..." : ""}`;
        }).join("\n")}`
      : "\n_No reviews available_";

    return `## Location ${i + 1}: ${loc.title}
- Address: ${loc.address}
- City: ${loc.city ?? "Unknown"}
- Google Rating: ${loc.rating != null ? loc.rating.toFixed(1) + "★" : "No rating"}
- Total Reviews: ${loc.totalReviews ?? "Unknown"}${reviewsBlock}`;
  }).join("\n\n");

  const competitorsBlock = ctx.competitors.length === 0
    ? "_No competitors tracked yet_"
    : ctx.competitors.map(c => {
        const reviewsBlock = c.recentReviews.length > 0
          ? `\n### Recent Reviews Sample\n${c.recentReviews.map(r => {
              const when = r.publishTime ? `(${relativeTime(r.publishTime, now)}) ` : "";
              const truncated = (r.text || "").length > 250;
              const text = (r.text || "").slice(0, 250);
              return `- [${r.rating}★] ${when}— ${text}${truncated ? "..." : ""}`;
            }).join("\n")}`
          : "";

        return `## ${c.name}
- Category: ${c.category ?? "Unknown"}
- City: ${c.city ?? "Unknown"}
- Google Rating: ${c.rating != null ? c.rating.toFixed(1) + "★" : "No rating"}
- Total Reviews: ${c.totalReviews ?? "Unknown"}${reviewsBlock}`;
      }).join("\n\n");

  return `You are a senior competitive intelligence and local market analyst preparing a confidential brief for ${businessName}'s leadership team. Your reader is the founder or CMO — time-poor, sophisticated, skeptical of generic advice.

Analyze the data provided: the business's Google Business Profile, recent reviews with timestamps, named competitors in the same catchment, and the company context (target customer, services, growth priorities).

Return ONE JSON object matching the schema below. NO prose outside the JSON. NO markdown code fences. Raw JSON only.

## Critical rules
1. Every numeric value comes from provided data OR is a clearly hedged estimate based on Indian market knowledge (prefix with "approx" or "estimated")
2. Reviewer quotes use exact reviewer names from the data
3. Catchment intelligence draws on your knowledge of Indian neighborhoods, demographics, and local commerce — hedge appropriately ("typically," "tends to be")
4. Never use "Facebook" — use "Meta"
5. If a field cannot be determined, use the string "n/a" — do NOT omit fields
6. CI analyst tone: dry, evidence-first, hedged. "The data suggests" not "we should." No emoji, no exclamation points.

## Chart data rules
- review_velocity_90d should have 12-13 weekly buckets covering the last 90 days. Period labels short like "Mar 1-7" or "Wk Mar 1". Count is the integer number of reviews that landed in that week.
- competitive_bars must include the business itself as the FIRST entry, then each named competitor in the order they appear in the data block.
- theme_frequency entries should match the themes[] array. Count is approximate (your read of how many recent reviews touched the theme).
- chart_findings should be 2-3 short observational entries about the velocity chart specifically, hedged ("the data suggests," "appears to indicate").

## STATUS FLAGS for scorecard cards
- green: clearly above market / strong
- yellow: mixed signals / behind one competitor / needs attention
- red: clearly below market / declining / urgent

## JSON Schema (return EXACTLY this structure)

{
  "scorecard": {
    "rating": { "value": "<e.g. 4.9>", "label": "Rating", "context": "<one short sentence>", "status": "green|yellow|red" },
    "reviews": { "value": "<formatted count, e.g. 613>", "label": "Total Reviews", "context": "<one sentence including comparison to top competitor>", "status": "green|yellow|red" },
    "velocity": { "value": "<approx X/mo>", "label": "Review Velocity", "context": "<one sentence>", "status": "green|yellow|red" },
    "competitive_position": { "value": "<rank like '2 of 3'>", "label": "Competitive Position", "context": "<one sentence>", "status": "green|yellow|red" },
    "sentiment": { "value": "<short label like 'Stable Positive'>", "label": "Sentiment", "context": "<one sentence>", "status": "green|yellow|red" }
  },
  "executive_summary": "<3-4 dense sentences. Lead with the single most important finding. End with the single biggest opportunity.>",
  "themes": [
    {
      "name": "<2-4 word theme>",
      "sentiment": "positive|mixed|negative",
      "frequency": "<rough frequency phrase>",
      "description": "<2 sentences>",
      "evidence": [
        {"reviewer": "<exact name>", "quote": "<max 12 words>"}
      ]
    }
  ],
  "sentiment_trend": "<2-3 sentences on whether sentiment appears stable, improving, or shifting based on recent reviews vs older>",
  "competitive_comparison": {
    "headers": ["Metric", "<Business Name>", "<Competitor 1>", "<Competitor 2>"],
    "rows": [
      {"label": "Rating", "values": ["", "", ""]},
      {"label": "Total Reviews", "values": ["", "", ""]},
      {"label": "Approx. Velocity", "values": ["", "", ""]},
      {"label": "Strongest Theme", "values": ["", "", ""]},
      {"label": "Key Gap", "values": ["", "", ""]}
    ],
    "analysis": "<2-3 short paragraphs identifying the 2-3 sharpest competitive gaps. Name competitors. Tie to evidence.>"
  },
  "catchment_intelligence": {
    "geographic_summary": "<2 sentences describing the catchment: neighborhoods, character, accessibility>",
    "demographics": {
      "primary_demographics": "<one sentence: age range, family vs single, professional makeup>",
      "estimated_households_in_catchment": "<estimate with 'approx' prefix, like 'approx 25,000-35,000 households within 3km'>",
      "summary": "<1-2 sentence narrative>"
    },
    "household_affluence": {
      "tier": "<Lower middle | Middle | Upper middle | Affluent | Mixed>",
      "indicators": "<one sentence: real estate signals, shop mix, lifestyle markers>",
      "estimated_relevant_tg_households": "<estimate of households matching the business's TG, with rationale>",
      "summary": "<1-2 sentence narrative>"
    },
    "market_leaders": [
      {"name": "<business name>", "category": "<adjacent or same category>", "relevance": "<one sentence on why this matters>"}
    ],
    "tg_match": {
      "match_strength": "Strong|Moderate|Weak",
      "rationale": "<2-3 sentences on how well catchment demographics align with the business's stated TG>",
      "growth_localities": [
        {"name": "<locality name>", "rationale": "<one sentence on why this is a growth opportunity>"}
      ]
    }
  },
  "recommendations": [
    {
      "title": "<action verb + specific action, e.g. 'Launch Greater Kailash review acquisition campaign'>",
      "rationale": "<one short paragraph tying to evidence above>",
      "expected_outcome": "<single line>",
      "priority": "high|medium|low",
      "timeframe": "<e.g. 'Next 30 days'>"
    }
  ],
  "chart_data": {
    "review_velocity_90d": [
      {"period": "<short label like 'Mar 1-7' or 'Wk Mar 1'>", "count": 0}
    ],
    "competitive_bars": [
      {"competitor": "<short name>", "rating": 0, "total_reviews": 0}
    ],
    "theme_frequency": [
      {"theme": "<theme name matching one entry in themes[]>", "count": 0, "sentiment": "positive|mixed|negative"}
    ],
    "chart_findings": [
      "<plain-English finding tied to the velocity chart, max 25 words. e.g. 'Velocity dropped 60% in the second week of March, then recovered slowly.'>"
    ]
  }
}

Now produce the JSON for this business:

# DATA

## Company Profile
${companyHeader}

## Business Description
${cc.businessDescription ?? "Not provided"}

## Unique Selling Proposition
${cc.uniqueSellingProposition ?? "Not provided"}

## Key Services
${cc.keyServices ?? "Not provided"}

## Target Customer
${cc.targetCustomer ?? "Not provided"}

## Customer Journey
${(cc.customerJourneyStages ?? []).join(" → ") || "Not provided"}

## Primary Goals
${(cc.primaryGoals ?? []).join(", ") || "Not provided"}

## Competitive Context (as stated by business)
${cc.competitiveContext ?? "Not provided"}

## Key Differentiators
${cc.keyDifferentiators ?? "Not provided"}

## Growth Priorities
${cc.growthPriorities ?? "Not provided"}

## Operational Challenges
${cc.operationalChallenges ?? "Not provided"}

# LOCATIONS DATA

${locationsBlock}

# COMPETITORS DATA

${competitorsBlock}`;
}

// Specific-bucket relative time formatter. Prefers exact day/week/month
// counts so the LLM can reason about review velocity precisely:
//   "3 days ago"   not "this week"
//   "2 weeks ago"  not "recently"
//   "5 months ago" not "earlier this year"
function relativeTime(publishTime: string, now: Date): string {
  if (!publishTime) return "";
  const ts = new Date(publishTime).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffSec = Math.max(0, Math.round((now.getTime() - ts) / 1000));

  if (diffSec < 60) return "just now";

  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;

  // Use raw day count rather than rounded hours, so a review at 36h reads
  // "1 day" not "2 days." Math.floor here matches typical user expectation.
  const diffDay = Math.floor((now.getTime() - ts) / (1000 * 60 * 60 * 24));
  if (diffDay <= 1) return diffDay === 0 ? "today" : "yesterday";
  if (diffDay < 14) return `${diffDay} days ago`;

  const diffWeek = Math.round(diffDay / 7);
  if (diffWeek < 9) return `${diffWeek} weeks ago`;

  const diffMonth = Math.round(diffDay / 30);
  if (diffMonth < 24) return `${diffMonth} month${diffMonth === 1 ? "" : "s"} ago`;

  const diffYear = Math.round(diffDay / 365);
  return `${diffYear} year${diffYear === 1 ? "" : "s"} ago`;
}
