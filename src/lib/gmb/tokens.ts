import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { refreshAccessToken } from "@/lib/gmb/oauth";

// Loads a connected_account by id, decrypts its refresh token, calls Google to
// mint a fresh access token, and writes a row to token_refresh_log either way.
// If Google says invalid_grant the account is flipped to status='revoked' so
// the rest of the app surfaces a reconnect prompt instead of looping retries.
export async function refreshGmbToken(accountId: string): Promise<{ access_token: string }> {
  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from("connected_accounts")
    .select("id, user_id, encrypted_refresh_token, status")
    .eq("id", accountId)
    .single();

  if (error || !account) throw new Error("Connected account not found");
  if (account.status !== "active") throw new Error(`Account status: ${account.status}`);

  const refreshToken = decrypt(account.encrypted_refresh_token);
  try {
    const t = await refreshAccessToken(refreshToken);
    await admin.from("token_refresh_log").insert({
      user_id: account.user_id,
      connected_account_id: account.id,
      success: true,
    });
    return { access_token: t.access_token };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await admin.from("token_refresh_log").insert({
      user_id: account.user_id,
      connected_account_id: account.id,
      success: false,
      error_message: msg.slice(0, 500),
    });
    if (/invalid_grant/i.test(msg)) {
      await admin.from("connected_accounts").update({ status: "revoked" }).eq("id", accountId);
    }
    throw e;
  }
}
