"use client";
import { X } from "lucide-react";
import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

export function FilterPill({ locationTitle }: { locationTitle: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const params = new URLSearchParams(search.toString());
  params.delete("locationId");
  const clearHref = `${pathname}${params.toString() ? "?" + params.toString() : ""}`;

  return (
    <div className="inline-flex items-center gap-2 bg-brand-indigo/10 border border-brand-indigo/40 text-brand-indigo rounded-full px-3 py-1 text-xs">
      <span>Filtered to: <span className="font-medium">{locationTitle}</span></span>
      <Link href={clearHref} className="hover:text-white"><X className="h-3.5 w-3.5" /></Link>
    </div>
  );
}
