import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  const started = Date.now();

  try {
    const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "ENCRYPTION_KEY", "GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_MAPS_API_KEY"];
    const missing = required.filter(k => !process.env[k]);
    checks.env = { ok: missing.length === 0, detail: missing.length ? `missing: ${missing.join(",")}` : "all set" };
  } catch (e) {
    checks.env = { ok: false, detail: e instanceof Error ? e.message : "unknown" };
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("users").select("id", { count: "exact", head: true });
    checks.supabase = { ok: !error, detail: error?.message };
  } catch (e) {
    checks.supabase = { ok: false, detail: e instanceof Error ? e.message : "unknown" };
  }

  const allOk = Object.values(checks).every(c => c.ok);
  const responseTime = Date.now() - started;

  return NextResponse.json(
    { status: allOk ? "healthy" : "degraded", responseTimeMs: responseTime, checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 }
  );
}
