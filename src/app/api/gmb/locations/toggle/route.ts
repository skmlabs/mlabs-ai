import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json() as { locationId?: string; isActive?: boolean };
  if (!body.locationId || typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "locationId and isActive required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("locations")
    .update({ is_active: body.isActive })
    .eq("id", body.locationId)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
