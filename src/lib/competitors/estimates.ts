/**
 * Formula B — estimate competitor calls/directions/website clicks based on
 * review velocity ratio against the user's owned locations.
 *
 *   user_velocity              = reviews per month across user's owned locations
 *   user_calls_per_velocity    = user's total calls / user_velocity
 *   estimated_competitor_calls = competitor_velocity * user_calls_per_velocity
 *
 * Same shape for directions and website clicks. Falls back through
 * city+category → city → category → global → none if the bucket is empty.
 */

export interface CompetitorEstimateInput {
  competitorId: string;
  city: string | null;
  category: string | null;
  recentReviews: Array<{ publishTime: string }>;
  totalRatings: number | null;
}

export interface OwnedLocationStats {
  locationId: string;
  city: string | null;
  category: string | null;
  recentReviews: Array<{ publishTime: string }>;
  totalRatings: number | null;
  // Trailing-30d totals from GMB Performance API (or whatever the table uses).
  calls30d: number;
  directions30d: number;
  website30d: number;
}

export type CalibrationBasis = "city+category" | "city" | "category" | "global" | "none";

export interface CompetitorEstimates {
  competitorId: string;
  reviewVelocityPerMonth: number;
  estimatedCalls30d: number | null;
  estimatedDirections30d: number | null;
  estimatedWebsite30d: number | null;
  calibrationBasis: CalibrationBasis;
}

// Reviews per month over the trailing window. Places API caps at 5 reviews per
// place so this is a coarse proxy — better than nothing while we wait on full
// review history via GMB v4.
function computeVelocity(
  reviews: Array<{ publishTime: string }>,
  windowDays = 90,
): number {
  if (!reviews || reviews.length === 0) return 0;
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const recent = reviews.filter(r => new Date(r.publishTime).getTime() >= cutoff);
  return (recent.length / windowDays) * 30;
}

export function estimateForCompetitor(
  competitor: CompetitorEstimateInput,
  ownedLocations: OwnedLocationStats[],
): CompetitorEstimates {
  const competitorVelocity = computeVelocity(competitor.recentReviews);
  const roundedVelocity = Math.round(competitorVelocity * 10) / 10;

  const empty = (basis: CalibrationBasis): CompetitorEstimates => ({
    competitorId: competitor.competitorId,
    reviewVelocityPerMonth: roundedVelocity,
    estimatedCalls30d: null,
    estimatedDirections30d: null,
    estimatedWebsite30d: null,
    calibrationBasis: basis,
  });

  if (ownedLocations.length === 0) return empty("none");

  // Bucket fallback chain: city+category → city → category → global.
  let bucket = ownedLocations.filter(l =>
    l.city === competitor.city && l.category === competitor.category,
  );
  let basis: CalibrationBasis = "city+category";

  if (bucket.length === 0) {
    bucket = ownedLocations.filter(l => l.city === competitor.city);
    basis = "city";
  }
  if (bucket.length === 0) {
    bucket = ownedLocations.filter(l => l.category === competitor.category);
    basis = "category";
  }
  if (bucket.length === 0) {
    bucket = ownedLocations;
    basis = "global";
  }

  const totalUserVelocity = bucket.reduce((sum, l) => sum + computeVelocity(l.recentReviews), 0);
  if (totalUserVelocity === 0) return empty("none");

  const totalUserCalls = bucket.reduce((sum, l) => sum + l.calls30d, 0);
  const totalUserDirections = bucket.reduce((sum, l) => sum + l.directions30d, 0);
  const totalUserWebsite = bucket.reduce((sum, l) => sum + l.website30d, 0);

  const callsPerVelocity = totalUserCalls / totalUserVelocity;
  const directionsPerVelocity = totalUserDirections / totalUserVelocity;
  const websitePerVelocity = totalUserWebsite / totalUserVelocity;

  return {
    competitorId: competitor.competitorId,
    reviewVelocityPerMonth: roundedVelocity,
    estimatedCalls30d: Math.round(competitorVelocity * callsPerVelocity),
    estimatedDirections30d: Math.round(competitorVelocity * directionsPerVelocity),
    estimatedWebsite30d: Math.round(competitorVelocity * websitePerVelocity),
    calibrationBasis: basis,
  };
}
