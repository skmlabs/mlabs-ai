import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCompanyContext,
  updateCompanyContext,
  type CompanyContext,
} from "@/lib/queries/companyContext";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const context = await getCompanyContext(user.id);
    return NextResponse.json({ context });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load company context";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Partial<CompanyContext>;
  try {
    body = await req.json() as Partial<CompanyContext>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const updated = await updateCompanyContext(user.id, body);
    return NextResponse.json({ context: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update company context";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
