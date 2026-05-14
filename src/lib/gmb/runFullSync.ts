import { createAdminClient } from "@/lib/supabase/admin";
import { fetchGmbAccounts, fetchGmbLocations, formatAddress } from "@/lib/gmb/client";

export interface FullSyncResult {
  accountsFound: number;
  locationsSynced: number;
}

// Shared full-sync routine. Called both from the manual /api/gmb/locations/sync
// route and from the OAuth callback (via `after()`) so a fresh connect kicks off
// the same parallel Places + metrics + reviews fan-out the manual button does.
// Caller is responsible for auth — this function trusts `userId` and `accountId`.
export async function runFullSyncForAccount(userId: string, accountId: string): Promise<FullSyncResult> {
  const admin = createAdminClient();

  const { data: account, error: accountErr } = await admin
    .from("connected_accounts")
    .select("id, user_id, encrypted_refresh_token, status")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single();
  if (accountErr || !account) throw new Error("account not found");
  if (account.status !== "active") throw new Error(`account status: ${account.status}`);

  const gmbAccounts = await fetchGmbAccounts(account);
  let totalLocations = 0;

  for (const gmbAccount of gmbAccounts) {
    const locations = await fetchGmbLocations(account, gmbAccount.name);
    for (const loc of locations) {
      const gmbLocationId = loc.name.split("/").pop() ?? "";
      const rows = {
        user_id: userId,
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

  // Auto-sync Places data, GMB Performance metrics, AND GMB v4 reviews for
  // newly connected/reconnected locations. All three are non-blocking — the
  // outer call completes even if any fails. Run in parallel so callers (OAuth
  // callback, manual Sync button) don't wait on serial calls. Dynamic imports
  // keep the heavier sync libs out of the static bundle of routes that import
  // this module.
  try {
    const [
      { syncOwnedLocationsForUser },
      { syncGmbMetricsForUser },
      { fetchReviewsForAllLocations },
    ] = await Promise.all([
      import("@/lib/places/syncOwnedLocations"),
      import("@/lib/gmb/syncMetrics"),
      import("@/lib/gmb/reviewsApi"),
    ]);
    await Promise.all([
      syncOwnedLocationsForUser(userId).catch(e => {
        console.error("Places auto-sync after OAuth failed:", e);
        return null;
      }),
      syncGmbMetricsForUser(userId).catch(e => {
        console.error("GMB metrics auto-sync after OAuth failed:", e);
        return null;
      }),
      fetchReviewsForAllLocations(userId).catch(e => {
        console.error("GMB reviews auto-sync after OAuth failed:", e);
        return null;
      }),
    ]);
  } catch (e) {
    console.error("Auto-sync wrapper failed (non-blocking):", e);
  }

  return { accountsFound: gmbAccounts.length, locationsSynced: totalLocations };
}
