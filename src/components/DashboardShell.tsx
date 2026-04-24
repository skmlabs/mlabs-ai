"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/SidebarNav";
import { ContactSalesTrigger } from "@/components/ContactSalesTrigger";

interface Props {
  email: string;
  initials: string;
  children: React.ReactNode;
}

export function DashboardShell({ email, initials, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const close = () => setMobileOpen(false);

  return (
    <div className="min-h-screen bg-bg text-white">
      {/* Mobile menu toggle — only visible below md */}
      <button
        onClick={() => setMobileOpen(v => !v)}
        className="md:hidden fixed top-4 right-4 z-40 bg-bg-card border border-bg-border rounded-lg p-2"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile backdrop — tap to close */}
      {mobileOpen ? (
        <button
          onClick={close}
          className="md:hidden fixed inset-0 z-20 bg-black/60 backdrop-blur-sm"
          aria-label="Close menu"
          tabIndex={-1}
        />
      ) : null}

      {/* Sidebar — fixed on desktop, slide-in on mobile. Footer block pinned via flex-shrink-0
          so Talk-to-an-expert / user / Sign out never drift when async page content loads. */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-[240px] md:w-[200px]
          flex flex-col bg-bg-card border-r border-bg-border overflow-y-auto
          transform transition-transform duration-200 ease-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="flex-shrink-0 p-4">
          <div className="text-white font-bold">Local AI</div>
          <div className="text-xs text-muted">by MLabs Digital</div>
        </div>

        <SidebarNav onNavigate={close} />

        <div className="flex-shrink-0 p-4 space-y-3 border-t border-bg-border">
          <div className="w-full [&>button]:w-full">
            <ContactSalesTrigger label="Talk to an expert" variant="primary" size="sm" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="w-7 h-7 rounded-full bg-brand-indigo/20 flex items-center justify-center text-xs font-medium text-brand-indigo">
              {initials}
            </div>
            <div className="text-xs text-muted truncate" title={email}>{email}</div>
          </div>
          <form action="/auth/signout" method="POST">
            <button type="submit" className="w-full text-xs text-muted hover:text-white border border-bg-border rounded-md py-1.5">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="md:ml-[200px] min-h-screen p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
