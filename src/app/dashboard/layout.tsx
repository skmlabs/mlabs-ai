import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/SidebarNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = user.email ?? "unknown";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen flex">
      <aside className="w-[200px] bg-bg-card border-r border-bg-border p-4 flex flex-col">
        <div>
          <div className="text-white font-bold">MLabs AI</div>
          <div className="text-xs text-muted">by mlabs</div>
        </div>
        <SidebarNav />
        <div className="border-t border-bg-border pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-brand-indigo/20 flex items-center justify-center text-xs font-medium text-brand-indigo">
              {initials}
            </div>
            <div className="text-xs text-muted truncate" title={email}>{email}</div>
          </div>
          <form action="/auth/signout" method="POST">
            <button type="submit" className="w-full text-xs text-muted hover:text-white border border-bg-border rounded-md py-1.5">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-x-auto">{children}</main>
    </div>
  );
}
