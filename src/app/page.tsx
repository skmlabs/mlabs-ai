import Link from "next/link";
import { Zap, TrendingUp, MapPin } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <section className="flex-1 flex flex-col items-center justify-center p-6 py-16 md:py-24">
        <div className="max-w-3xl w-full text-center space-y-5">
          <div className="text-[11px] uppercase tracking-widest text-brand-indigo">MLabs AI · Private Beta</div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            Marketing intelligence for <span className="text-brand-indigo">multi-location brands</span>
          </h1>
          <p className="text-muted text-base md:text-lg max-w-2xl mx-auto">
            Unify Google Business Profile, Meta Ads, Google Ads, and more. Understand what&apos;s driving calls, foot traffic, and revenue — not just clicks. Built for brands with 5 to 500 locations and the agencies that serve them.
          </p>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login" className="w-full sm:w-auto inline-block bg-brand-indigo hover:bg-indigo-600 px-6 py-3 rounded-lg font-medium">
              Sign in with Google
            </Link>
            <a
              href="mailto:gudakesh@mlabsdigital.org?subject=MLabs%20AI%20Demo%20Request&body=Hi%20MLabs%20team%2C%20we%27d%20like%20to%20see%20a%20demo%20of%20the%20platform.%20Company%3A%20%20%2F%20Locations%3A%20%20%2F%20Current%20channels%3A%20"
              className="w-full sm:w-auto inline-block border border-bg-border hover:border-brand-indigo px-6 py-3 rounded-lg font-medium"
            >
              Request a demo
            </a>
          </div>
          <p className="text-xs text-muted pt-2">Currently serving clients in fintech, healthcare, and education.</p>
        </div>
      </section>

      <section className="bg-bg-card border-y border-bg-border px-6 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <div className="text-[11px] uppercase tracking-widest text-brand-amber">One platform. Every channel.</div>
            <h2 className="text-2xl md:text-3xl font-bold mt-2">Connect once. See everything.</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "Google Business Profile", status: "Live" },
              { name: "Meta Ads", status: "Coming soon" },
              { name: "Google Ads", status: "Coming soon" },
              { name: "GA4 & Search Console", status: "Coming soon" },
              { name: "LinkedIn Ads", status: "Coming soon" },
              { name: "Call tracking", status: "Coming soon" },
              { name: "WhatsApp Business", status: "Coming soon" },
              { name: "More on request", status: "" },
            ].map(c => (
              <div key={c.name} className="border border-bg-border rounded-lg px-4 py-3 text-sm">
                <div className="font-medium">{c.name}</div>
                {c.status ? <div className={`text-[11px] mt-0.5 ${c.status === "Live" ? "text-green-400" : "text-muted"}`}>{c.status}</div> : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-6">
          <div>
            <TrendingUp className="h-6 w-6 text-brand-indigo mb-3" />
            <h3 className="font-semibold mb-2">Deep funnel attribution</h3>
            <p className="text-sm text-muted">Connect ad spend to actual revenue — calls, directions, form fills, purchases. Not vanity metrics.</p>
          </div>
          <div>
            <MapPin className="h-6 w-6 text-brand-indigo mb-3" />
            <h3 className="font-semibold mb-2">Multi-location aware</h3>
            <p className="text-sm text-muted">Built for brands and agencies managing many locations. Filter, compare, drill down — instantly.</p>
          </div>
          <div>
            <Zap className="h-6 w-6 text-brand-indigo mb-3" />
            <h3 className="font-semibold mb-2">AI insights, not dashboards</h3>
            <p className="text-sm text-muted">Proactive analysis of what&apos;s working and what&apos;s not, benchmarked against peers. Coming Q2.</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-bg-border p-6 text-center text-xs text-muted">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <a href="https://mlabsdigital.org" target="_blank" rel="noopener noreferrer" className="hover:text-white">MLabs Digital</a>
          <span>·</span>
          <a href="https://mlabsdigital.org/privacy-policy/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Privacy Policy</a>
          <span>·</span>
          <a href="https://mlabsdigital.org/terms/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Terms of Service</a>
          <span>·</span>
          <a href="mailto:gudakesh@mlabsdigital.org" className="hover:text-white">Contact</a>
        </div>
        <div className="mt-2">© {new Date().getFullYear()} MLabs Digital Private Limited · CIN U80903DL2016PTC300259</div>
      </footer>
    </main>
  );
}
