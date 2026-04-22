import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name = (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="text-muted mt-2">
        Welcome{name ? `, ${name}` : ""}. GMB data will appear here after you connect an account in
        Settings.
      </p>
    </div>
  );
}
