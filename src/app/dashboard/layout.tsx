import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const email = user.email ?? "unknown";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <DashboardShell email={email} initials={initials}>
      {children}
    </DashboardShell>
  );
}
