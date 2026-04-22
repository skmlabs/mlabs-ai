import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError, data } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError?.message ?? "exchange_failed")}`
    );
  }

  // Upsert into public.users using service role (bypasses RLS on first insert)
  const admin = createAdminClient();
  const { id, email } = data.user;
  const fullName = (data.user.user_metadata?.full_name as string | undefined) ?? null;
  const avatarUrl = (data.user.user_metadata?.avatar_url as string | undefined) ?? null;

  if (!email) {
    return NextResponse.redirect(`${origin}/login?error=missing_email`);
  }

  await admin
    .from("users")
    .upsert({ id, email, full_name: fullName, avatar_url: avatarUrl }, { onConflict: "id" });

  return NextResponse.redirect(`${origin}${next}`);
}
