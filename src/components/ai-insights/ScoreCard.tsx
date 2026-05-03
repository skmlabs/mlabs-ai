import type { StatusFlag } from "@/lib/types/aiInsights";

interface Props {
  label: string;
  value: string;
  context: string;
  status: StatusFlag;
}

const STATUS_BAR_COLOR: Record<StatusFlag, string> = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
};

export function ScoreCard({ label, value, context, status }: Props) {
  return (
    <div className="bg-[#13131f] rounded-lg p-5 relative overflow-hidden border border-white/5">
      <div
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: STATUS_BAR_COLOR[status] }}
      />
      <div className="pl-3">
        <div className="text-xs uppercase tracking-wider text-[#6b7280] mb-2">{label}</div>
        <div className="text-3xl font-bold text-white leading-tight">{value}</div>
        <div className="text-xs text-[#9ca3af] leading-snug mt-2">{context}</div>
      </div>
    </div>
  );
}
