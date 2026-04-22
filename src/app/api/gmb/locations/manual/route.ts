import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

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

  if (!body.title || !body.placeId || !body.connectedAccountId) {
    return NextResponse.json({ error: "title, placeId, connectedAccountId required" }, { status: 400 });
  }

  const { data: account, error: aerr } = await supabase
    .from("connected_accounts")
    .select("id, user_id")
    .eq("id", body.connectedAccountId)
    .eq("user_id", user.id)
    .single();
  if (aerr || !account) return NextResponse.json({ error: "connected account not found" }, { status: 404 });

  const admin = createAdminClient();
  const gmbLocationId = body.locationResourceName?.split("/").pop() ?? `manual:${body.placeId}`;
  const locationResourceName = body.locationResourceName ?? `locations/manual:${body.placeId}`;

  const { data, error } = await admin.from("locations").upsert({
    user_id: user.id,
    connected_account_id: account.id,
    gmb_account_id: "manual",
    gmb_location_id: gmbLocationId,
    location_resource_name: locationResourceName,
    title: body.title,
    address: body.address ?? null,
    primary_phone: body.phone ?? null,
    website_uri: body.website ?? null,
    place_id: body.placeId,
    is_active: true,
  }, { onConflict: "connected_account_id,gmb_location_id" }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, locationId: data?.id });
}
