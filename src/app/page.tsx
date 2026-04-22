export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center space-y-4">
        <div className="text-sm uppercase tracking-widest text-brand-indigo">MLabs AI</div>
        <h1 className="text-5xl font-bold">Marketing Intelligence Platform</h1>
        <p className="text-muted max-w-xl">
          Connect your Google Business Profile and unlock AI-powered insights on
          calls, directions, reviews, and local visibility.
        </p>
        <div className="pt-8">
          <a href="/login" className="inline-block bg-brand-indigo hover:bg-indigo-600 px-6 py-3 rounded-lg font-medium">
            Sign in with Google
          </a>
        </div>
      </div>
    </main>
  );
}
