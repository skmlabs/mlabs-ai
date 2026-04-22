import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plug } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { count: accountsCount } = await supabase
    .from("connected_accounts").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("provider", "gmb");
  const { count: locationsCount } = await supabase
    .from("locations").select("id", { count: "exact", head: true }).eq("user_id", user!.id).eq("is_active", true);

  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="text-muted mt-1 text-sm">Welcome{name ? `, ${name}` : ""}.</p>

      {(accountsCount ?? 0) === 0 ? (
        <div className="mt-6 bg-bg-card border border-bg-border rounded-xl p-6 max-w-xl">
          <div className="flex items-center gap-3 mb-2"><Plug className="h-5 w-5 text-brand-indigo" /><h2 className="text-base font-semibold">Connect your first account</h2></div>
          <p className="text-sm text-muted mb-4">To start seeing insights, connect a Google Business Profile in Settings.</p>
          <Link href="/dashboard/settings" className="inline-block bg-brand-indigo hover:bg-indigo-600 px-4 py-2 rounded-lg text-sm font-medium">Go to Settings</Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 max-w-xl">
          <div className="bg-bg-card border border-bg-border rounded-xl p-4">
            <div className="text-xs uppercase tracking-wider text-muted">Connected accounts</div>
            <div className="text-3xl font-bold mt-1">{accountsCount ?? 0}</div>
          </div>
          <div className="bg-bg-card border border-bg-border rounded-xl p-4">
            <div className="text-xs uppercase tracking-wider text-muted">Active locations</div>
            <div className="text-3xl font-bold mt-1">{locationsCount ?? 0}</div>
          </div>
        </div>
      )}
      <p className="text-xs text-muted mt-8">Metrics (calls, directions, website clicks) will populate after Day 3 is built and Google Business Profile API access is approved.</p>
    </div>
  );
}
