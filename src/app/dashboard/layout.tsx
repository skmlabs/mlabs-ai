import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SidebarNav } from "@/components/SidebarNav";
import { ContactSalesTrigger } from "@/components/ContactSalesTrigger";

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
          <div className="text-white font-bold">Local AI</div>
          <div className="text-xs text-muted">by MLabs Digital</div>
        </div>
        <SidebarNav />
        {/* Footer block is pushed to the bottom via mt-auto so the "Talk to an expert"
            button sits in exactly the same spot on every dashboard page, regardless
            of main content height. */}
        <div className="mt-auto pt-4 border-t border-bg-border space-y-3">
          <div className="w-full [&>button]:w-full">
            <ContactSalesTrigger label="Talk to an expert" variant="primary" size="sm" />
          </div>
          <div className="flex items-center gap-2 pt-1">
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
