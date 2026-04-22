import { Clock3 } from "lucide-react";

export function PendingAccessBanner() {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 rounded-xl p-4 flex items-start gap-3">
      <Clock3 className="h-5 w-5 mt-0.5 flex-shrink-0" />
      <div>
        <div className="font-medium text-sm">Awaiting Google API access approval</div>
        <div className="text-xs text-amber-200/80 mt-1">
          Your Google Business Profile connection is active. Daily call, direction, and website click metrics will populate automatically within 24 hours of Google granting Basic API access (currently pending).
        </div>
      </div>
    </div>
  );
}
