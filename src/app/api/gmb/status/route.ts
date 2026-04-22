import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false, reason: "unauthenticated" }, { status: 401 });

  const { data, error } = await supabase
    .from("connected_accounts")
    .select("id, google_account_email, google_account_name, status, last_synced_at, created_at")
    .eq("user_id", user.id)
    .eq("provider", "gmb")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connected: (data?.length ?? 0) > 0, accounts: data ?? [] });
}
