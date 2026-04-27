import { createClient } from "@/lib/supabase/server";
import { getCompanyContext, type CompanyContext } from "@/lib/queries/companyContext";

// Shape of a Places API review object as stored in JSONB columns. Both
// locations.places_recent_reviews and competitors.recent_reviews use this
// shape (see src/lib/places/placesNewApi.ts).
interface RawPlacesReview {
  rating?: number;
  text?: { text?: string; languageCode?: string };
  originalText?: { text?: string; languageCode?: string };
  publishTime?: string;
  authorAttribution?: { displayName?: string; photoUri?: string };
}

export interface InsightsContext {
  companyContext: CompanyContext;
  locations: Array<{
    title: string;
    address: string;
    city: string | null;
    rating: number | null;
    totalReviews: number | null;
    recentReviews: Array<{ rating: number; text: string; publishTime: string; authorName?: string }>;
    // GMB Performance API metrics — wired in later phase when GMB approval propagates.
    calls7d: number | null;
    directions7d: number | null;
    websiteClicks7d: number | null;
  }>;
  competitors: Array<{
    name: string;
    category: string | null;
    city: string | null;
    rating: number | null;
    totalReviews: number | null;
    recentReviews: Array<{ rating: number; text: string; publishTime: string }>;
  }>;
  timeRangeDays: number;
}

export async function buildInsightsContext(
  userId: string,
  timeRangeDays: number = 7,
): Promise<InsightsContext> {
  const supabase = await createClient();

  const companyContext = await getCompanyContext(userId);

  const { data: locationsRaw, error: locErr } = await supabase
    .from("locations")
    .select("title, address, city, places_rating, places_total_ratings, places_recent_reviews")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (locErr) throw new Error(`locations fetch failed: ${locErr.message}`);

  const locations = (locationsRaw ?? []).map(loc => {
    const rawReviews: RawPlacesReview[] = Array.isArray(loc.places_recent_reviews)
      ? (loc.places_recent_reviews as RawPlacesReview[])
      : [];
    return {
      title: loc.title,
      address: loc.address ?? "",
      city: loc.city,
      rating: loc.places_rating !== null ? Number(loc.places_rating) : null,
      totalReviews: loc.places_total_ratings,
      recentReviews: rawReviews.slice(0, 5).map(r => ({
        rating: typeof r.rating === "number" ? r.rating : 0,
        text: r.text?.text ?? r.originalText?.text ?? "",
        publishTime: r.publishTime ?? "",
        authorName: r.authorAttribution?.displayName,
      })),
      calls7d: null,
      directions7d: null,
      websiteClicks7d: null,
    };
  });

  const { data: competitorsRaw, error: compErr } = await supabase
    .from("competitors")
    .select("name, category, city, rating, total_ratings, recent_reviews")
    .eq("user_id", userId);

  if (compErr) throw new Error(`competitors fetch failed: ${compErr.message}`);

  const competitors = (competitorsRaw ?? []).map(c => {
    const rawReviews: RawPlacesReview[] = Array.isArray(c.recent_reviews)
      ? (c.recent_reviews as RawPlacesReview[])
      : [];
    return {
      name: c.name,
      category: c.category,
      city: c.city,
      rating: c.rating !== null ? Number(c.rating) : null,
      totalReviews: c.total_ratings,
      recentReviews: rawReviews.slice(0, 3).map(r => ({
        rating: typeof r.rating === "number" ? r.rating : 0,
        text: r.text?.text ?? r.originalText?.text ?? "",
        publishTime: r.publishTime ?? "",
      })),
    };
  });

  return { companyContext, locations, competitors, timeRangeDays };
}
