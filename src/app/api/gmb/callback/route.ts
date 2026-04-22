import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, getGoogleUserInfo } from "@/lib/gmb/oauth";
import { encrypt } from "@/lib/crypto";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/dashboard/settings?gmb_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/dashboard/settings?gmb_error=missing_params`);
  }

  const cookieState = request.cookies.get("gmb_oauth_state")?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(`${origin}/dashboard/settings?gmb_error=state_mismatch`);
  }
  const redirectUri = request.cookies.get("gmb_oauth_redirect_uri")?.value;
  if (!redirectUri) {
    return NextResponse.redirect(`${origin}/dashboard/settings?gmb_error=missing_redirect_uri`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      // This happens if the user previously consented and we didn't force prompt=consent.
      // Our buildGoogleAuthUrl forces prompt=consent, so this shouldn't happen — but if it does,
      // it means the existing grant needs to be revoked at accounts.google.com.
      return NextResponse.redirect(`${origin}/dashboard/settings?gmb_error=no_refresh_token`);
    }
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    const admin = createAdminClient();
    const encryptedRefresh = encrypt(tokens.refresh_token);
    const scopesArray = tokens.scope.split(" ").filter(Boolean);

    const { error: upsertErr } = await admin
      .from("connected_accounts")
      .upsert(
        {
          user_id: user.id,
          provider: "gmb",
          google_account_email: userInfo.email,
          google_account_name: userInfo.name ?? null,
          encrypted_refresh_token: encryptedRefresh,
          scope: tokens.scope,
          scopes_array: scopesArray,
          status: "active",
          last_synced_at: null,
        },
        { onConflict: "user_id,provider,google_account_email" }
      );

    if (upsertErr) {
      return NextResponse.redirect(`${origin}/dashboard/settings?gmb_error=${encodeURIComponent(upsertErr.message)}`);
    }

    const res = NextResponse.redirect(`${origin}/dashboard/settings?gmb_connected=1`);
    res.cookies.delete("gmb_oauth_state");
    res.cookies.delete("gmb_oauth_redirect_uri");
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.redirect(`${origin}/dashboard/settings?gmb_error=${encodeURIComponent(msg)}`);
  }
}
