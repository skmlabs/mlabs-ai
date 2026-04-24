"use client";

import { Download } from "lucide-react";

interface Props {
  onClick: () => void | Promise<void>;
  label?: string;
  disabled?: boolean;
}

export function ExportButton({ onClick, label = "Export", disabled }: Props) {
  return (
    <button
      type="button"
      onClick={() => { void onClick(); }}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-bg-border rounded-lg hover:border-brand-indigo/50 hover:bg-bg-card text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
