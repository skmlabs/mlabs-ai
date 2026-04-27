import type { InsightsContext } from "./buildInsightsContext";

// THE prompt. Quality of insights is determined here. Hedged framing,
// specific names, specific numbers, no hallucination, no generic advice.
//
// Output structure is enforced: 5 h2 sections, ~1.5-2.5k words total.
export function buildInsightsPrompt(ctx: InsightsContext): string {
  const cc = ctx.companyContext ?? {};

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
          const author = r.authorName ? `${r.authorName}: ` : "";
          const truncated = (r.text || "").length > 400;
          const text = (r.text || "").slice(0, 400);
          return `${j + 1}. [${r.rating}★] ${author}${text}${truncated ? "..." : ""}`;
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
              const truncated = (r.text || "").length > 250;
              const text = (r.text || "").slice(0, 250);
              return `- [${r.rating}★] ${text}${truncated ? "..." : ""}`;
            }).join("\n")}`
          : "";

        return `## ${c.name}
- Category: ${c.category ?? "Unknown"}
- City: ${c.city ?? "Unknown"}
- Google Rating: ${c.rating != null ? c.rating.toFixed(1) + "★" : "No rating"}
- Total Reviews: ${c.totalReviews ?? "Unknown"}${reviewsBlock}`;
      }).join("\n\n");

  return `You are a senior local marketing analyst writing an executive insights brief for ${cc.brandName ?? "this business"}. Your audience is the Marketing Head — they want sharp, specific, hedged analysis. Not generic advice.

# CRITICAL OUTPUT RULES (READ CAREFULLY)

1. NEVER invent data. Only reference numbers, names, and facts that appear in the CONTEXT below. If you don't have data for something, do NOT speculate.

2. Use HEDGED FRAMING throughout. Phrases like:
   - "It seems..."
   - "It's worth checking whether..."
   - "There's a possibility that..."
   - "The data suggests..."
   - "Worth investigating..."

   Avoid declarative claims like "this is happening" — use "this appears to be happening."

3. Reference SPECIFIC NAMES — locations by their actual title, competitors by their actual name. Never say "your competitors" — say "ICliniX (4.8★) and EyeSetu (5.0★)."

4. Cite SPECIFIC NUMBERS from the context. Don't say "many reviews" — say "604 total reviews vs ICliniX's 1.2k."

5. Recommendations must be SPECIFIC and ACTIONABLE — not generic advice like "respond to reviews faster." Instead: "Of your last 5 reviews on ${cc.brandName ?? "this location"}, 1 was 1-star — worth checking whether the staff training process flags such cases for follow-up within 48 hours."

6. NEVER recommend increasing total marketing spend unless the data shows a specific channel underperforming.

7. Output format is structured markdown with these EXACT section headers (h2):
   ## Executive Summary
   ## Local Visibility & Discoverability
   ## Review Health & Sentiment
   ## Competitive Position
   ## Strategic Recommendations

8. Length: ~1,500-2,500 words total. Each section 200-500 words.

# CONTEXT

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

${competitorsBlock}

# TASK

Generate the insights brief now using the EXACT structure (h2 section headers) specified above. Open with "## Executive Summary" containing 3-4 sentences capturing the most important findings. Then the four detailed sections. Close without a "Conclusion" header — let the Strategic Recommendations be the final section.

Remember: hedged framing, specific names, specific numbers, no hallucination, no generic advice. Quality over length.`;
}
