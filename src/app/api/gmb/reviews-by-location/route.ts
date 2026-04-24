import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const locationFilter = searchParams.get("locationId");
  const minRating = searchParams.get("minRating");
  const maxRating = searchParams.get("maxRating");

  // Exclude manual entries — Reviews tab shows only GMB-synced locations.
  let locQuery = supabase.from("locations").select("id, title, address, place_id, is_active").eq("user_id", user.id).eq("is_active", true).neq("gmb_account_id", "manual");
  if (locationFilter) locQuery = locQuery.eq("id", locationFilter);
  const { data: locations } = await locQuery;
  const locs = locations ?? [];
  if (locs.length === 0) return NextResponse.json({ groups: [] });
  const locIds = locs.map(l => l.id);

  const { data: stats } = await supabase
    .from("location_review_stats")
    .select("location_id, average_rating, total_reviews, last_fetched_at")
    .in("location_id", locIds);
  const statsMap = new Map((stats ?? []).map(s => [s.location_id, s]));

  let revQuery = supabase
    .from("cached_reviews")
    .select("id, location_id, author_name, author_photo_url, rating, text, publish_time")
    .in("location_id", locIds)
    .order("publish_time", { ascending: false, nullsFirst: false });

  if (minRating) revQuery = revQuery.gte("rating", parseInt(minRating, 10));
  if (maxRating) revQuery = revQuery.lte("rating", parseInt(maxRating, 10));

  const { data: reviews } = await revQuery;

  const byLoc = new Map<string, {
    location_id: string;
    title: string;
    address: string | null;
    avg_rating: number | null;
    total_reviews: number;
    distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
    reviews: Array<{ id: string; author_name: string | null; author_photo_url: string | null; rating: number | null; text: string | null; publish_time: string | null }>;
  }>();

  for (const l of locs) {
    const s = statsMap.get(l.id);
    byLoc.set(l.id, {
      location_id: l.id,
      title: l.title,
      address: l.address,
      avg_rating: s?.average_rating ?? null,
      total_reviews: s?.total_reviews ?? 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      reviews: [],
    });
  }
  for (const r of reviews ?? []) {
    const g = byLoc.get(r.location_id);
    if (!g) continue;
    g.reviews.push({ id: r.id, author_name: r.author_name, author_photo_url: r.author_photo_url, rating: r.rating, text: r.text, publish_time: r.publish_time });
    const rating = r.rating;
    if (rating !== null && rating >= 1 && rating <= 5) {
      g.distribution[rating as 1 | 2 | 3 | 4 | 5]++;
    }
  }

  return NextResponse.json({ groups: Array.from(byLoc.values()) });
}
