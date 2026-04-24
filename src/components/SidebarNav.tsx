"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/locations", label: "My Locations" },
  { href: "/dashboard/reviews", label: "Reviews" },
  { href: "/dashboard/settings", label: "Settings" },
];

interface Props {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: Props) {
  const pathname = usePathname();
  const active = (href: string) => href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  return (
    <nav className="flex-1 mt-6 space-y-1 text-sm px-2">
      {LINKS.map(l => (
        <Link
          key={l.href}
          href={l.href}
          onClick={onNavigate}
          className={`block px-3 py-2 rounded-md transition ${active(l.href) ? "bg-brand-indigo text-white" : "text-muted hover:text-white"}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
