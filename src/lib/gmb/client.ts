import { decrypt } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAccessToken } from "./oauth";

type StoredAccount = {
  id: string;
  user_id: string;
  encrypted_refresh_token: string;
};

async function getFreshAccessToken(account: StoredAccount): Promise<string> {
  const admin = createAdminClient();
  const refreshToken = decrypt(account.encrypted_refresh_token);
  try {
    const t = await refreshAccessToken(refreshToken);
    await admin.from("token_refresh_log").insert({
      user_id: account.user_id,
      connected_account_id: account.id,
      success: true,
    });
    return t.access_token;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("token_refresh_log").insert({
      user_id: account.user_id,
      connected_account_id: account.id,
      success: false,
      error_message: msg.slice(0, 500),
    });
    // If the refresh token itself is dead, mark the account revoked
    if (/invalid_grant/i.test(msg)) {
      await admin.from("connected_accounts").update({ status: "revoked" }).eq("id", account.id);
    }
    throw e;
  }
}

export async function fetchGmbAccounts(account: StoredAccount): Promise<Array<{ name: string; accountName?: string; type?: string; role?: string; verificationState?: string; vettedState?: string }>> {
  const accessToken = await getFreshAccessToken(account);
  const res = await fetch("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`accounts list failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { accounts?: Array<{ name: string; accountName?: string; type?: string; role?: string; verificationState?: string; vettedState?: string }> };
  return data.accounts ?? [];
}

export async function fetchGmbLocations(account: StoredAccount, gmbAccountResourceName: string): Promise<Array<{
  name: string; title: string; storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string; regionCode?: string }; phoneNumbers?: { primaryPhone?: string }; websiteUri?: string; metadata?: { placeId?: string }; latlng?: { latitude?: number; longitude?: number }; categories?: { primaryCategory?: { displayName?: string } };
}>> {
  const accessToken = await getFreshAccessToken(account);
  const readMask = [
    "name",
    "title",
    "storefrontAddress",
    "phoneNumbers",
    "websiteUri",
    "metadata",
    "latlng",
    "categories",
  ].join(",");
  const u = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${gmbAccountResourceName}/locations`);
  u.searchParams.set("readMask", readMask);
  u.searchParams.set("pageSize", "100");
  const res = await fetch(u, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`locations list failed: ${res.status} ${await res.text()}`);
  const data = await res.json() as { locations?: unknown[] };
  return (data.locations ?? []) as Array<{ name: string; title: string; storefrontAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string; regionCode?: string }; phoneNumbers?: { primaryPhone?: string }; websiteUri?: string; metadata?: { placeId?: string }; latlng?: { latitude?: number; longitude?: number }; categories?: { primaryCategory?: { displayName?: string } } }>;
}

export function formatAddress(a?: { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string; regionCode?: string }): string | null {
  if (!a) return null;
  const parts = [
    ...(a.addressLines ?? []),
    a.locality,
    a.administrativeArea,
    a.postalCode,
    a.regionCode,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
