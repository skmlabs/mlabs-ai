import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="bg-bg-card border border-bg-border rounded-xl p-8 text-center max-w-md">
        <div className="text-[11px] uppercase tracking-widest text-brand-indigo mb-3">Page not found</div>
        <h1 className="text-3xl font-bold mb-2">404</h1>
        <p className="text-muted text-sm mb-6">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link href="/dashboard" className="inline-block bg-brand-indigo hover:bg-indigo-600 px-4 py-2 rounded-lg text-sm font-medium">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
