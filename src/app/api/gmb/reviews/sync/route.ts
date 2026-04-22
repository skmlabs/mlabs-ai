import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { fetchReviewsFromPlaces, upsertReviews } from "@/lib/gmb/reviews";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: locs, error } = await supabase
    .from("locations")
    .select("id, place_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .not("place_id", "is", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let ok = 0, failed = 0;
  for (const loc of locs ?? []) {
    if (!loc.place_id) continue;
    const r = await fetchReviewsFromPlaces(loc.place_id);
    if (r.status === "ok") {
      await upsertReviews({ userId: user.id, locationId: loc.id, placeId: loc.place_id, reviews: r.reviews, rating: r.rating, totalReviews: r.totalReviews });
      ok++;
    } else failed++;
  }
  return NextResponse.json({ ok: true, synced: ok, failed });
}
