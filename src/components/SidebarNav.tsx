"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/locations", label: "My Locations" },
  { href: "/dashboard/reviews", label: "Reviews" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const active = (href: string) => href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  return (
    <nav className="mt-6 space-y-1 text-sm">
      {LINKS.map(l => (
        <Link
          key={l.href}
          href={l.href}
          className={`block px-3 py-2 rounded-md transition ${active(l.href) ? "bg-brand-indigo text-white" : "text-muted hover:text-white"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
