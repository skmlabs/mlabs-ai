import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshGmbToken } from "@/lib/gmb/tokens";

export const runtime = "nodejs";

const GMB_API_BASE = "https://mybusiness.googleapis.com/v4";
const MAX_REPLY_LENGTH = 4000;

// `reviewId` here is the cached_reviews UUID PK — URL-safe and unambiguous.
// The actual GMB resource name comes from cached_reviews.google_review_name.

interface RouteContext {
  params: Promise<{ reviewId: string }>;
}

async function loadReviewContext(rowId: string, userId: string) {
  const admin = createAdminClient();

  const { data: review, error: reviewErr } = await admin
    .from("cached_reviews")
    .select("id, location_id, user_id, google_review_name, publish_time")
    .eq("id", rowId)
    .eq("user_id", userId)
    .single();
  if (reviewErr || !review) return { error: "Review not found", status: 404 as const };

  const { data: location } = await admin
    .from("locations")
    .select("id, gmb_account_id, location_resource_name, connected_account_id")
    .eq("id", review.location_id)
    .single();
  if (!location) return { error: "Location not found", status: 404 as const };

  if (!location.location_resource_name || location.gmb_account_id === "manual") {
    return { error: "Reply unavailable for manual locations", status: 400 as const };
  }

  // Reply URL on GMB v4 = {accountResource}/{locationResource}/reviews/{reviewIdPart}/reply
  // google_review_name already encodes the full path. Just append /reply.
  const replyUrl = `${GMB_API_BASE}/${review.google_review_name}/reply`;

  return { admin, review, location, replyUrl };
}

async function getAccessToken(connectedAccountId: string): Promise<string> {
  const t = await refreshGmbToken(connectedAccountId);
  return t.access_token;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reviewId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const replyText = typeof (body as { reply_text?: unknown }).reply_text === "string"
    ? ((body as { reply_text: string }).reply_text).trim()
    : "";

  if (!replyText) return NextResponse.json({ error: "Reply text required" }, { status: 400 });
  if (replyText.length > MAX_REPLY_LENGTH) {
    return NextResponse.json({ error: `Reply too long (max ${MAX_REPLY_LENGTH} chars)` }, { status: 400 });
  }

  const ctxRes = await loadReviewContext(reviewId, user.id);
  if ("error" in ctxRes) return NextResponse.json({ error: ctxRes.error }, { status: ctxRes.status });
  const { admin, review, location, replyUrl } = ctxRes;

  let accessToken: string;
  try {
    accessToken = await getAccessToken(location.connected_account_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Auth failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Profile name for replied_by_name attribution. users.full_name is the real
  // column (NOT users.name); fall back to email if name was never set.
  const { data: profile } = await admin
    .from("users")
    .select("full_name, email")
    .eq("id", user.id)
    .single();
  const repliedByName = profile?.full_name || profile?.email || "Unknown";

  const res = await fetch(replyUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment: replyText }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("GMB reply error:", res.status, errBody.slice(0, 300));
    return NextResponse.json({ error: `Failed to post reply: ${res.status}` }, { status: 500 });
  }

  const replyData = await res.json().catch(() => ({})) as { updateTime?: string };
  const replyTime = replyData.updateTime ?? new Date().toISOString();

  await admin.from("cached_reviews").update({
    reply_text: replyText,
    reply_create_time: replyTime,
    reply_update_time: replyTime,
    replied_by_user_id: user.id,
    replied_by_name: repliedByName,
  }).eq("id", review.id);

  return NextResponse.json({ ok: true, replyTime, repliedBy: repliedByName });
}

// PATCH = edit. GMB v4 uses the same PUT endpoint for both create and update.
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return POST(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reviewId } = await ctx.params;
  const ctxRes = await loadReviewContext(reviewId, user.id);
  if ("error" in ctxRes) return NextResponse.json({ error: ctxRes.error }, { status: ctxRes.status });
  const { admin, review, location, replyUrl } = ctxRes;

  let accessToken: string;
  try {
    accessToken = await getAccessToken(location.connected_account_id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Auth failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const res = await fetch(replyUrl, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 404 means the reply was already gone — accept and clear locally.
  if (!res.ok && res.status !== 404) {
    return NextResponse.json({ error: `Failed to delete reply: ${res.status}` }, { status: 500 });
  }

  await admin.from("cached_reviews").update({
    reply_text: null,
    reply_create_time: null,
    reply_update_time: null,
    replied_by_user_id: null,
    replied_by_name: null,
  }).eq("id", review.id);

  return NextResponse.json({ ok: true });
}
