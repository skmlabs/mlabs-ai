"use client";
import { ChevronDown, ChevronUp } from "lucide-react";

export type SortDir = "asc" | "desc";

export function SortableHeader({ label, active, dir, onClick, align = "left" }: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-2 text-[11px] uppercase tracking-wider text-muted select-none cursor-pointer hover:text-white transition ${align === "right" ? "text-right" : "text-left"}`}
      onClick={onClick}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
      </span>
    </th>
  );
}
