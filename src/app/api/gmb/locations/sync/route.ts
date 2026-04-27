import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchGmbAccounts, fetchGmbLocations, formatAddress } from "@/lib/gmb/client";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const { data: account, error: accountErr } = await supabase
    .from("connected_accounts")
    .select("id, user_id, encrypted_refresh_token, status")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();
  if (accountErr || !account) return NextResponse.json({ error: "account not found" }, { status: 404 });
  if (account.status !== "active") return NextResponse.json({ error: `account status: ${account.status}` }, { status: 409 });

  try {
    const gmbAccounts = await fetchGmbAccounts(account);
    const admin = createAdminClient();
    let totalLocations = 0;

    for (const gmbAccount of gmbAccounts) {
      const locations = await fetchGmbLocations(account, gmbAccount.name);
      for (const loc of locations) {
        const gmbLocationId = loc.name.split("/").pop() ?? "";
        const rows = {
          user_id: user.id,
          connected_account_id: account.id,
          gmb_account_id: gmbAccount.name,
          gmb_location_id: gmbLocationId,
          location_resource_name: loc.name,
          title: loc.title,
          address: formatAddress(loc.storefrontAddress),
          primary_phone: loc.phoneNumbers?.primaryPhone ?? null,
          website_uri: loc.websiteUri ?? null,
          place_id: loc.metadata?.placeId ?? null,
          latitude: loc.latlng?.latitude ?? null,
          longitude: loc.latlng?.longitude ?? null,
          categories: loc.categories ?? null,
          is_active: true,
        };
        await admin.from("locations").upsert(rows, { onConflict: "connected_account_id,gmb_location_id" });
        totalLocations++;
      }
    }

    await admin.from("connected_accounts").update({ last_synced_at: new Date().toISOString() }).eq("id", account.id);

    // Auto-sync Places data AND GMB Performance metrics for newly connected/
    // reconnected locations. Both are non-blocking — OAuth completes even if
    // either fails. Run in parallel so the user isn't waiting on serial calls.
    // Dynamic imports keep the heavier sync libs out of this route's static bundle.
    try {
      const [{ syncOwnedLocationsForUser }, { syncGmbMetricsForUser }] = await Promise.all([
        import("@/lib/places/syncOwnedLocations"),
        import("@/lib/gmb/syncMetrics"),
      ]);
      await Promise.all([
        syncOwnedLocationsForUser(user.id).catch(e => {
          console.error("Places auto-sync after OAuth failed:", e);
          return null;
        }),
        syncGmbMetricsForUser(user.id).catch(e => {
          console.error("GMB metrics auto-sync after OAuth failed:", e);
          return null;
        }),
      ]);
    } catch (e) {
      console.error("Auto-sync wrapper failed (non-blocking):", e);
      // Do NOT throw — OAuth flow must succeed regardless.
    }

    return NextResponse.json({ ok: true, accountsFound: gmbAccounts.length, locationsSynced: totalLocations });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
