import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

export const runtime = "nodejs";

type ContactLeadInsert = {
  user_id: string | null;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string | null;
  source_page: string | null;
  referrer: string | null;
  user_agent: string | null;
  ip_address: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const company = typeof body.company === "string" ? body.company.trim() : "";

    if (!name || name.length < 2) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    if (!phone || phone.length < 6) return NextResponse.json({ error: "Valid phone required" }, { status: 400 });
    if (!company) return NextResponse.json({ error: "Company is required" }, { status: 400 });

    const source_page = typeof body.source_page === "string" ? body.source_page.slice(0, 200) : null;
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;
    const user_agent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
    const forwarded = req.headers.get("x-forwarded-for");
    const ip_address = forwarded ? forwarded.split(",")[0]!.trim() : req.headers.get("x-real-ip") ?? null;

    let user_id: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      user_id = user?.id ?? null;
    } catch {
      user_id = null;
    }

    const admin = createAdminClient();
    const lead: ContactLeadInsert = { user_id, name, email, phone, company, message: null, source_page, referrer, user_agent, ip_address };
    const { data: inserted, error: insertErr } = await admin.from("contact_leads").insert(lead).select().single();
    if (insertErr) {
      console.error("contact_leads insert error:", insertErr);
      return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const notifyEmails = (process.env.CONTACT_NOTIFY_EMAILS ?? "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    if (resendKey && notifyEmails.length > 0) {
      try {
        const resend = new Resend(resendKey);
        await resend.emails.send({
          from: "Local AI <noreply@send.mlabsdigital.org>",
          to: notifyEmails,
          replyTo: email,
          subject: `New Lead: ${company} — ${name}`,
          html: buildLeadEmail({ name, email, phone, company, source_page, referrer, user_id, lead_id: inserted.id }),
        });
      } catch (emailErr) {
        // Lead saved OK; email failure is non-blocking
        console.error("Resend email error:", emailErr);
      }
    }

    return NextResponse.json({ ok: true, lead_id: inserted.id });
  } catch (err) {
    console.error("contact-sales error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

function buildLeadEmail(lead: {
  name: string; email: string; phone: string; company: string;
  source_page: string | null; referrer: string | null;
  user_id: string | null; lead_id: string;
}): string {
  const esc = (s: string | null) => s ? s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#039;" }[c] ?? c)) : "";
  const context = lead.user_id ? `<span style="color:#10b981">Logged-in user</span>` : `<span style="color:#6b7280">Anonymous visitor</span>`;
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9fafb;">
  <div style="background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#6366f1;margin-bottom:8px">Local AI · New Lead</div>
    <h1 style="margin:0 0 24px;font-size:24px;color:#111827">${esc(lead.name)} from ${esc(lead.company)}</h1>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;width:120px">Email</td><td style="padding:8px 0"><a href="mailto:${esc(lead.email)}" style="color:#6366f1">${esc(lead.email)}</a></td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Phone</td><td style="padding:8px 0"><a href="tel:${esc(lead.phone)}" style="color:#6366f1">${esc(lead.phone)}</a></td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Company</td><td style="padding:8px 0;font-weight:500">${esc(lead.company)}</td></tr>
      <tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Context</td><td style="padding:8px 0">${context}</td></tr>
      ${lead.source_page ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">From page</td><td style="padding:8px 0;color:#6b7280;font-size:13px">${esc(lead.source_page)}</td></tr>` : ""}
      ${lead.referrer ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px">Referrer</td><td style="padding:8px 0;color:#6b7280;font-size:13px;word-break:break-all">${esc(lead.referrer)}</td></tr>` : ""}
    </table>

    <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin-top:16px">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px">Lead ID</div>
      <div style="font-family:monospace;font-size:12px;color:#111827">${lead.lead_id}</div>
    </div>

    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center">
      Local AI · by MLabs Digital · local.mlabsdigital.org
    </div>
  </div>
</div>`;
}
