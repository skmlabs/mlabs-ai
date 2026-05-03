import type { CompetitiveBar, CompetitiveComparison } from "@/lib/types/aiInsights";
import { CompetitiveTable } from "./CompetitiveTable";
import { CompetitiveBars } from "./CompetitiveBars";
import { EyebrowText } from "./EyebrowText";

interface Props {
  comparison: CompetitiveComparison;
  bars: CompetitiveBar[];
}

export function CompetitivePosition({ comparison, bars }: Props) {
  const paragraphs = (comparison.analysis ?? "").split(/\n\n+/).map(p => p.trim()).filter(Boolean);

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <CompetitiveTable comparison={comparison} />
        <CompetitiveBars bars={bars} />
      </div>
      <div className="bg-[#13131f] border border-white/5 rounded-lg p-6">
        <EyebrowText>Competitive Gaps · Analysis</EyebrowText>
        {paragraphs.length > 0
          ? paragraphs.map((para, i) => (
              <p key={i} className="text-sm text-[#e5e7eb] leading-relaxed mb-3 last:mb-0">
                {para}
              </p>
            ))
          : <p className="text-sm text-[#9ca3af] italic">No analysis available.</p>}
      </div>
    </div>
  );
}
