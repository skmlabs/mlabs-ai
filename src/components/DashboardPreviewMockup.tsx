"use client";
import { MapPin, Star, TrendingUp, Phone, MessageSquare } from "lucide-react";

export function DashboardPreviewMockup() {
  return (
    <div className="relative w-full max-w-4xl mx-auto mt-12">
      {/* Main dashboard preview card */}
      <div className="relative bg-bg-card border border-bg-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Fake browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-bg border-b border-bg-border">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/70" />
            <div className="w-3 h-3 rounded-full bg-amber-400/70" />
            <div className="w-3 h-3 rounded-full bg-green-400/70" />
          </div>
          <div className="flex-1 text-center">
            <div className="inline-block text-[10px] text-muted bg-bg-card border border-bg-border rounded px-3 py-0.5 font-mono">
              local.mlabsdigital.org/dashboard
            </div>
          </div>
        </div>

        {/* Dashboard body */}
        <div className="p-6 space-y-4">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted">Overview · Last 28 days</div>
              <div className="text-lg font-semibold mt-0.5">Performance across 4 locations</div>
            </div>
            <div className="hidden sm:flex gap-1.5">
              <div className="text-[10px] border border-bg-border rounded-md px-2 py-1 text-muted">7d</div>
              <div className="text-[10px] bg-brand-indigo text-white rounded-md px-2 py-1">28d</div>
              <div className="text-[10px] border border-bg-border rounded-md px-2 py-1 text-muted">90d</div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total calls", value: "1,847", change: "+24%", icon: Phone, color: "indigo" },
              { label: "Directions", value: "3.2k", change: "+18%", icon: MapPin, color: "amber" },
              { label: "Website clicks", value: "892", change: "+41%", icon: TrendingUp, color: "emerald" },
              { label: "Avg rating", value: "4.7 ★", change: "+0.2", icon: Star, color: "amber" },
            ].map((k, i) => {
              const Icon = k.icon;
              return (
                <div key={i} className="bg-bg border border-bg-border rounded-lg p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon className={`h-3 w-3 ${k.color === "indigo" ? "text-brand-indigo" : k.color === "amber" ? "text-brand-amber" : "text-emerald-400"}`} />
                    <span className="text-[10px] text-muted uppercase tracking-wide">{k.label}</span>
                  </div>
                  <div className="text-lg font-bold">{k.value}</div>
                  <div className="text-[10px] text-emerald-400">{k.change}</div>
                </div>
              );
            })}
          </div>

          {/* Stylized chart area */}
          <div className="bg-bg border border-bg-border rounded-lg p-4 h-40 relative overflow-hidden">
            <div className="text-[10px] text-muted uppercase tracking-wide mb-2">Daily trend</div>
            {/* Stylized SVG chart */}
            <svg className="w-full h-24" viewBox="0 0 400 80" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[20, 40, 60].map(y => (
                <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.05)" strokeDasharray="2 2" />
              ))}
              {/* Calls line (indigo) with gradient fill */}
              <path d="M 0 60 L 40 50 L 80 45 L 120 55 L 160 40 L 200 35 L 240 30 L 280 25 L 320 20 L 360 15 L 400 12 L 400 80 L 0 80 Z" fill="url(#chart-fill)" />
              <path d="M 0 60 L 40 50 L 80 45 L 120 55 L 160 40 L 200 35 L 240 30 L 280 25 L 320 20 L 360 15 L 400 12" fill="none" stroke="#6366f1" strokeWidth="2" />
              {/* Directions line (amber) */}
              <path d="M 0 55 L 40 58 L 80 50 L 120 45 L 160 48 L 200 40 L 240 42 L 280 35 L 320 32 L 360 28 L 400 22" fill="none" stroke="#f59e0b" strokeWidth="2" />
              {/* Website line (emerald) */}
              <path d="M 0 65 L 40 62 L 80 60 L 120 58 L 160 55 L 200 52 L 240 48 L 280 45 L 320 42 L 360 40 L 400 35" fill="none" stroke="#10b981" strokeWidth="2" />
              {/* Dots on latest point */}
              <circle cx="400" cy="12" r="3" fill="#6366f1" />
              <circle cx="400" cy="22" r="3" fill="#f59e0b" />
              <circle cx="400" cy="35" r="3" fill="#10b981" />
            </svg>
          </div>
        </div>
      </div>

      {/* Floating data cards — positioned absolutely around main card */}

      {/* Top-left: New review card */}
      <div className="hidden md:block absolute -top-6 -left-12 bg-bg-card border border-brand-amber/30 rounded-xl p-3 shadow-lg shadow-brand-amber/10 backdrop-blur animate-float">
        <div className="flex items-center gap-2 mb-1">
          <Star className="h-3.5 w-3.5 text-brand-amber fill-brand-amber" />
          <span className="text-[10px] text-muted uppercase tracking-wide">New review</span>
        </div>
        <div className="text-xs font-semibold">Your Business</div>
        <div className="flex items-center gap-0.5 mt-1">
          {[1,2,3,4,5].map(i => <Star key={i} className="h-2.5 w-2.5 text-brand-amber fill-brand-amber" />)}
        </div>
        <div className="text-[10px] text-muted mt-1">&ldquo;Best in the area!&rdquo;</div>
      </div>

      {/* Top-right: Call alert card */}
      <div className="hidden md:block absolute -top-4 -right-10 bg-bg-card border border-brand-indigo/30 rounded-xl p-3 shadow-lg shadow-brand-indigo/10 backdrop-blur animate-float-delayed">
        <div className="flex items-center gap-2 mb-1">
          <Phone className="h-3.5 w-3.5 text-brand-indigo" />
          <span className="text-[10px] text-muted uppercase tracking-wide">Calls today</span>
        </div>
        <div className="text-lg font-bold">67</div>
        <div className="text-[10px] text-emerald-400">+38% vs yesterday</div>
      </div>

      {/* Bottom-right: AI insight card */}
      <div className="hidden md:block absolute -bottom-8 -right-6 bg-bg-card border border-brand-indigo/30 rounded-xl p-3 shadow-lg shadow-brand-indigo/10 backdrop-blur animate-float-slower max-w-[220px]">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-3.5 w-3.5 text-brand-indigo" />
          <span className="text-[10px] text-muted uppercase tracking-wide">AI insight</span>
        </div>
        <div className="text-xs leading-relaxed">Your Monday call volume is 3x higher than weekends. Consider extending Monday hours.</div>
      </div>
    </div>
  );
}
