import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, getGoogleUserInfo } from "@/lib/gmb/oauth";
import { encrypt } from "@/lib/crypto";
import { runFullSyncForAccount } from "@/lib/gmb/runFullSync";
import { setSyncProgress } from "@/lib/sync/progress";
import { NextResponse, after, type NextRequest } from "next/server";

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

    const { data: upserted, error: upsertErr } = await admin
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
      )
      .select("id")
      .single();

    if (upsertErr || !upserted) {
      const msg = upsertErr?.message ?? "upsert_failed";
      return NextResponse.redirect(`${origin}/dashboard/settings?gmb_error=${encodeURIComponent(msg)}`);
    }

    // Prime the Redis progress key BEFORE redirecting so the locations page,
    // which starts polling on mount, sees `status: "running"` immediately and
    // doesn't flash an "idle" / OnboardingGate state. The real total/completed
    // numbers are filled in by syncOwnedLocationsForUser once it knows the
    // location count. Safe no-op if Redis isn't configured.
    await setSyncProgress(user.id, {
      total: 0,
      completed: 0,
      status: "running",
      startedAt: Date.now(),
    });

    // Kick off the full sync (locations upsert + Places + metrics + reviews)
    // in the background. `after()` keeps the work alive past the redirect
    // response on Vercel, so the unawaited promise isn't killed when this
    // serverless function returns.
    const accountId = upserted.id as string;
    after(async () => {
      try {
        await runFullSyncForAccount(user.id, accountId);
      } catch (e) {
        console.error("Auto-sync after OAuth failed:", e instanceof Error ? e.message : e);
      }
    });

    const res = NextResponse.redirect(`${origin}/dashboard/locations?just_connected=1`);
    res.cookies.delete("gmb_oauth_state");
    res.cookies.delete("gmb_oauth_redirect_uri");
    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.redirect(`${origin}/dashboard/settings?gmb_error=${encodeURIComponent(msg)}`);
  }
}
