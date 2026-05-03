import type { CatchmentIntelligence as CatchmentData } from "@/lib/types/aiInsights";
import { DemographicsCard } from "./DemographicsCard";
import { AffluenceCard } from "./AffluenceCard";
import { MarketLeadersCard } from "./MarketLeadersCard";
import { TGMatchCard } from "./TGMatchCard";

interface Props {
  intel: CatchmentData;
}

export function CatchmentIntelligence({ intel }: Props) {
  return (
    <div>
      <div className="bg-[#13131f] border border-white/5 rounded-lg p-5 mb-4">
        <p className="text-base text-[#e5e7eb] leading-relaxed">{intel.geographic_summary}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DemographicsCard demographics={intel.demographics} />
        <AffluenceCard affluence={intel.household_affluence} />
        <MarketLeadersCard leaders={intel.market_leaders} />
        <TGMatchCard tgMatch={intel.tg_match} />
      </div>
    </div>
  );
}
