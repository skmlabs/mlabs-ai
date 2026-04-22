export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-[185px] bg-bg-card border-r border-bg-border p-4">
        <div className="text-white font-bold">MLabs AI</div>
        <div className="text-xs text-muted">by mlabs</div>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
