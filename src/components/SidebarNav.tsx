"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const LINKS: { href: string; label: string; showBadge?: boolean }[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/locations", label: "My Locations" },
  { href: "/dashboard/inbox", label: "Reviews Inbox", showBadge: true },
  { href: "/dashboard/reviews", label: "Reviews" },
  { href: "/dashboard/settings", label: "Settings" },
];

interface Props {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: Props) {
  const pathname = usePathname();
  const active = (href: string) => href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  const [unresponded, setUnresponded] = useState<number>(0);

  const loadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/reviews/unresponded-count", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json() as { count?: number };
        setUnresponded(typeof j.count === "number" ? j.count : 0);
      }
    } catch { /* ignore — sidebar badge is best-effort */ }
  }, []);

  // Refetch on mount, on path change (user just acted), and every 60s.
  useEffect(() => {
    loadCount();
    const id = window.setInterval(loadCount, 60_000);
    return () => window.clearInterval(id);
  }, [loadCount, pathname]);

  return (
    <nav className="flex-1 mt-6 space-y-1 text-sm px-2">
      {LINKS.map(l => (
        <Link
          key={l.href}
          href={l.href}
          onClick={onNavigate}
          className={`flex items-center px-3 py-2 rounded-md transition ${active(l.href) ? "bg-brand-indigo text-white" : "text-muted hover:text-white"}`}
        >
          <span>{l.label}</span>
          {l.showBadge && unresponded > 0 ? (
            <span className="ml-auto bg-brand-amber text-bg text-[10px] font-bold px-2 py-0.5 rounded-full">
              {unresponded > 99 ? "99+" : unresponded}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
