import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Lightweight count for the sidebar badge. Manual locations are excluded
// because the user can't actually reply to them through this app.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  // Get the user's non-manual location ids first so the count reflects only
  // reviewable locations.
  const { data: locs } = await supabase
    .from("locations")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .neq("gmb_account_id", "manual");

  const locIds = (locs ?? []).map(l => l.id);
  if (locIds.length === 0) return NextResponse.json({ count: 0 });

  const { count } = await supabase
    .from("cached_reviews")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("has_reply", false)
    .in("location_id", locIds);

  return NextResponse.json({ count: count ?? 0 });
}
