import Link from "next/link";
import { ContactSalesTrigger } from "@/components/ContactSalesTrigger";
import { AnimatedMap } from "@/components/AnimatedMap";
import { MapPin, Star, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-bg text-white flex flex-col">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-lg border-b border-bg-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-indigo/20 border border-brand-indigo/40 flex items-center justify-center">
              <MapPin className="h-4 w-4 text-brand-indigo" />
            </div>
            <span className="font-bold text-lg">Local AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-muted hover:text-white transition">Sign in</Link>
            <ContactSalesTrigger label="Contact Sales" variant="primary" size="sm" />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <AnimatedMap />
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-24 md:py-32 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-indigo/10 border border-brand-indigo/30 text-xs uppercase tracking-widest text-brand-indigo">
            <Sparkles className="h-3 w-3" />
            Local AI · by MLabs Digital
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight">
            Know your Google presence.<br />
            <span className="bg-gradient-to-r from-brand-indigo to-brand-amber bg-clip-text text-transparent">Grow your business.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted max-w-2xl mx-auto">
            AI-powered insights for your Google Business Profile. Track calls, directions, reviews, and customer behavior across all your locations — in one beautiful dashboard.
          </p>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-brand-indigo hover:bg-indigo-600 px-6 py-3 rounded-lg font-medium transition shadow-lg shadow-brand-indigo/30">
              Sign in with Google
            </Link>
            <ContactSalesTrigger label="Book a demo →" variant="outline" size="lg" />
          </div>
          <p className="text-xs text-muted pt-4">Private beta · Serving enterprises and agencies</p>
        </div>
      </section>

      {/* Value Props */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <div className="text-xs uppercase tracking-widest text-brand-amber mb-2">Why Local AI</div>
          <h2 className="text-3xl md:text-4xl font-bold">One place for everything local</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-bg-card border border-bg-border rounded-xl p-6 hover:border-brand-indigo/50 hover:shadow-lg hover:shadow-brand-indigo/10 transition">
            <div className="w-10 h-10 rounded-lg bg-brand-indigo/10 border border-brand-indigo/30 flex items-center justify-center mb-4">
              <MapPin className="h-5 w-5 text-brand-indigo" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Built for multi-location</h3>
            <p className="text-sm text-muted">Track every location in one place. Filter, compare, drill down — instantly. Whether you have 2 stores or 200.</p>
          </div>
          <div className="bg-bg-card border border-bg-border rounded-xl p-6 hover:border-brand-amber/50 hover:shadow-lg hover:shadow-brand-amber/10 transition">
            <div className="w-10 h-10 rounded-lg bg-brand-amber/10 border border-brand-amber/30 flex items-center justify-center mb-4">
              <Star className="h-5 w-5 text-brand-amber fill-brand-amber" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Reviews, managed</h3>
            <p className="text-sm text-muted">See reviews from all locations in one feed. Reply without switching tabs. Never miss a response.</p>
          </div>
          <div className="bg-bg-card border border-bg-border rounded-xl p-6 hover:border-brand-indigo/50 hover:shadow-lg hover:shadow-brand-indigo/10 transition">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-indigo/20 to-brand-amber/20 border border-brand-indigo/30 flex items-center justify-center mb-4">
              <Sparkles className="h-5 w-5 text-brand-indigo" />
            </div>
            <h3 className="font-semibold text-lg mb-2">AI insights, not dashboards</h3>
            <p className="text-sm text-muted">Proactive analysis of what&apos;s working and what&apos;s not. Weekly reports delivered to your inbox.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-bg-card border-y border-bg-border px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-xs uppercase tracking-widest text-brand-indigo mb-2">How it works</div>
            <h2 className="text-3xl md:text-4xl font-bold">Live data in 60 seconds</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { n: "1", title: "Sign in with Google", desc: "Secure OAuth. No passwords. Onboard in 30 seconds." },
              { n: "2", title: "Connect your Business Profile", desc: "We pull your locations, reviews, and performance data. Read-only — we never modify your listing without your action." },
              { n: "3", title: "Grow what works", desc: "Use AI insights to understand what drives customers and what to fix next. Act on the signal, not the noise." },
            ].map(step => (
              <div key={step.n} className="relative">
                <div className="text-6xl font-bold text-brand-indigo/20 absolute -top-4 -left-2">{step.n}</div>
                <div className="relative pt-6">
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-muted">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Private Beta / Contact Sales */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center space-y-6">
        <div className="text-xs uppercase tracking-widest text-brand-amber">Private beta</div>
        <h2 className="text-3xl md:text-4xl font-bold">Built for businesses that take local seriously</h2>
        <p className="text-muted">
          Local AI is currently onboarding a select group of enterprise customers and agencies. We work closely with each partner to deliver real, measurable business impact — not vanity metrics.
        </p>
        <p className="text-muted">
          If you run a business with multiple locations — or an agency serving such businesses — let&apos;s talk.
        </p>
        <div className="pt-4">
          <ContactSalesTrigger label="Contact Sales" variant="primary" size="lg" />
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-widest text-brand-indigo mb-2">FAQ</div>
          <h2 className="text-3xl md:text-4xl font-bold">Things people ask</h2>
        </div>
        <div className="space-y-3">
          {[
            { q: "What does Local AI do?", a: "Local AI unifies your Google Business Profile data across all locations into a single dashboard. Track calls, directions, reviews, and customer behavior. Use AI-powered insights to understand what's driving growth." },
            { q: "Which Google Business Profile features work?", a: "Read performance data (calls, directions, website clicks), read and reply to reviews, benchmark against competitors. Local AI is read-first — we never modify your Business Profile without explicit action like replying to a review." },
            { q: "Do I need Google Ads or Meta accounts?", a: "No. Local AI works with Google Business Profile alone. For multi-channel marketing analytics (Meta Ads, Google Ads, GA4, attribution), check out MLabs Digital's enterprise offering." },
            { q: "Is my data secure?", a: "Yes. OAuth tokens are encrypted at rest with AES-256-GCM. Your data is isolated per account using Row Level Security at the database layer. We never share or sell your data. You can disconnect anytime." },
            { q: "How do I get started?", a: "We're onboarding customers through direct conversation. Click 'Contact Sales' above and we'll schedule a quick demo and get you set up within 48 hours." },
          ].map((item, i) => (
            <details key={i} className="group bg-bg-card border border-bg-border rounded-lg">
              <summary className="flex items-center justify-between cursor-pointer px-5 py-4 font-medium list-none">
                {item.q}
                <span className="text-muted group-open:rotate-180 transition">⌄</span>
              </summary>
              <div className="px-5 pb-4 text-sm text-muted">{item.a}</div>
            </details>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-bg-border mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded bg-brand-indigo/20 border border-brand-indigo/40 flex items-center justify-center">
                  <MapPin className="h-3 w-3 text-brand-indigo" />
                </div>
                <span className="font-semibold">Local AI</span>
              </div>
              <p className="text-xs text-muted">A product of MLabs Digital · Built in India · Serving businesses globally.</p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
              <a href="https://mlabsdigital.org" target="_blank" rel="noopener noreferrer" className="hover:text-white">About MLabs</a>
              <ContactSalesTrigger label="Contact Sales" variant="link" size="sm" />
              <a href="https://mlabsdigital.org/privacy-policy/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Privacy</a>
              <a href="https://mlabsdigital.org/terms/" target="_blank" rel="noopener noreferrer" className="hover:text-white">Terms</a>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-bg-border text-xs text-muted text-center">
            © {new Date().getFullYear()} MLabs Digital Private Limited · CIN U80903DL2016PTC300259
          </div>
        </div>
      </footer>
    </main>
  );
}
