import { createClient } from "@/lib/supabase/server";
import { runFullSyncForAccount } from "@/lib/gmb/runFullSync";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  try {
    const { accountsFound, locationsSynced } = await runFullSyncForAccount(user.id, accountId);
    return NextResponse.json({ ok: true, accountsFound, locationsSynced });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    const status = msg === "account not found" ? 404 : msg.startsWith("account status:") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
