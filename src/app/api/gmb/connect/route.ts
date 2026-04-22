import { createClient } from "@/lib/supabase/server";
import { buildGoogleAuthUrl } from "@/lib/gmb/oauth";
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const state = randomBytes(16).toString("hex");
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/gmb/callback`;
  const authUrl = buildGoogleAuthUrl({ state, redirectUri });

  const res = NextResponse.redirect(authUrl);
  // Short-lived state cookie for CSRF protection on callback
  res.cookies.set("gmb_oauth_state", state, { httpOnly: true, secure: origin.startsWith("https://"), sameSite: "lax", path: "/", maxAge: 600 });
  res.cookies.set("gmb_oauth_redirect_uri", redirectUri, { httpOnly: true, secure: origin.startsWith("https://"), sameSite: "lax", path: "/", maxAge: 600 });
  return res;
}
