// Section eyebrow — small uppercase label that sits above each section in
// the AI Insights v2 page. Editorial-density convention.
import type { ReactNode } from "react";

export function EyebrowText({ children }: { children: ReactNode }) {
  return (
    <div className="text-xs uppercase tracking-wider font-medium text-[#6b7280] mb-3">
      {children}
    </div>
  );
}
