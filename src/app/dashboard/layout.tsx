import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
        <nav className="mt-6 flex-1 space-y-1 text-sm">
          <a href="/dashboard" className="block px-3 py-2 rounded-md bg-brand-indigo text-white">
            Overview
          </a>
          <a
            href="/dashboard/locations"
            className="block px-3 py-2 rounded-md text-muted hover:text-white"
          >
            Locations
          </a>
          <a
            href="/dashboard/reviews"
            className="block px-3 py-2 rounded-md text-muted hover:text-white"
          >
            Reviews
          </a>
          <a
            href="/dashboard/settings"
            className="block px-3 py-2 rounded-md text-muted hover:text-white"
          >
            Settings
          </a>
        </nav>
        <div className="border-t border-bg-border pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-brand-indigo/20 flex items-center justify-center text-xs font-medium text-brand-indigo">
              {initials}
            </div>
            <div className="text-xs text-muted truncate" title={email}>
              {email}
            </div>
          </div>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full text-xs text-muted hover:text-white border border-bg-border rounded-md py-1.5"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
