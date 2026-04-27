"use client";

import { MapPin } from "lucide-react";

interface Props {
  // Defaults to the existing GET handler that initiates the Google OAuth
  // flow (src/app/api/gmb/connect/route.ts). Override only if a future page
  // needs a different connect entry point.
  connectUrl?: string;
}

export function OnboardingGate({ connectUrl = "/api/gmb/connect" }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full bg-bg-card rounded-2xl p-8 border border-bg-border text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-brand-indigo/15 text-brand-indigo flex items-center justify-center">
          <MapPin className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Connect Your Google Business Profile
        </h2>
        <p className="text-muted mb-6 text-sm leading-relaxed">
          We&apos;ll pull your locations, reviews, and performance data automatically. Takes about 30 seconds.
        </p>
        <a
          href={connectUrl}
          className="inline-block w-full bg-brand-indigo hover:bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          Connect Google
        </a>
        <p className="text-muted text-xs mt-4">
          Already connected? Try refreshing the page.
        </p>
      </div>
    </div>
  );
}
