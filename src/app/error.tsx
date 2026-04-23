"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("app error:", error); }, [error]);
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="bg-bg-card border border-bg-border rounded-xl p-8 text-center max-w-md">
        <div className="text-[11px] uppercase tracking-widest text-red-400 mb-3">Something went wrong</div>
        <h1 className="text-3xl font-bold mb-2">Oops</h1>
        <p className="text-muted text-sm mb-2">An unexpected error occurred.</p>
        {error.digest ? <p className="text-xs text-muted mb-6 font-mono">ref: {error.digest}</p> : null}
        <div className="flex gap-2 justify-center">
          <button onClick={reset} className="bg-brand-indigo hover:bg-indigo-600 px-4 py-2 rounded-lg text-sm font-medium">Try again</button>
          <a href="/dashboard" className="border border-bg-border hover:border-brand-indigo px-4 py-2 rounded-lg text-sm">Go home</a>
        </div>
      </div>
    </main>
  );
}
