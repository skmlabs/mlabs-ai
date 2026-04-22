import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

function validPlaceId(s: string): boolean {
  // Google Place IDs are typically 27+ chars, begin with ChIJ/GhIJ/EhIJ/etc.
  return /^[A-Za-z0-9_-]{20,}$/.test(s);
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json() as {
    connectedAccountId?: string;
    title?: string;
    placeId?: string;
    address?: string;
    phone?: string;
    website?: string;
    locationResourceName?: string;
  };

  const title = body.title?.trim() ?? "";
  const placeId = body.placeId?.trim() ?? "";
  const connectedAccountId = body.connectedAccountId?.trim() ?? "";

  if (!title || !placeId || !connectedAccountId) {
    return NextResponse.json({ error: "title, placeId, connectedAccountId required" }, { status: 400 });
  }
  if (!validPlaceId(placeId)) {
    return NextResponse.json({ error: "Invalid Place ID format. Copy from Google Place ID Finder." }, { status: 400 });
  }

  // Verify the connected account belongs to this user
  const { data: account, error: aerr } = await supabase
    .from("connected_accounts")
    .select("id, user_id")
    .eq("id", connectedAccountId)
    .eq("user_id", user.id)
    .single();
  if (aerr || !account) return NextResponse.json({ error: "connected account not found" }, { status: 404 });

  // Check if this user already has a location with this place_id (prevent duplicate)
  const { data: existing } = await supabase
    .from("locations")
    .select("id, title")
    .eq("user_id", user.id)
    .eq("place_id", placeId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: `This Place ID is already tracked as "${existing.title}".` }, { status: 409 });
  }

  const admin = createAdminClient();
  // Use place_id as the unique suffix so every added location is distinct at the gmb_location_id level.
  // Format: manual:{placeId} — deterministic, one row per place_id per connected_account.
  const gmbLocationId = body.locationResourceName?.trim().split("/").pop() || `manual:${placeId}`;
  const locationResourceName = body.locationResourceName?.trim() || `locations/manual:${placeId}`;

  const { data, error } = await admin.from("locations").insert({
    user_id: user.id,
    connected_account_id: account.id,
    gmb_account_id: "manual",
    gmb_location_id: gmbLocationId,
    location_resource_name: locationResourceName,
    title,
    address: body.address?.trim() || null,
    primary_phone: body.phone?.trim() || null,
    website_uri: body.website?.trim() || null,
    place_id: placeId,
    is_active: true,
  }).select("id").single();

  if (error) {
    // If the composite-unique constraint fires somehow, surface a useful error.
    if (error.code === "23505") {
      return NextResponse.json({ error: "This location conflicts with an existing entry. Try removing it first." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, locationId: data?.id });
}
