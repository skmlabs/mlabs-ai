import type { Theme } from "@/lib/types/aiInsights";
import { ThemeCard } from "./ThemeCard";
import { EyebrowText } from "./EyebrowText";

interface Props {
  themes: Theme[];
  sentimentTrend: string;
}

export function ThemesGrid({ themes, sentimentTrend }: Props) {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {themes.map((theme, i) => (
          <ThemeCard key={`${theme.name}-${i}`} theme={theme} />
        ))}
      </div>
      <div className="bg-[#13131f] border border-white/5 rounded-lg p-5">
        <EyebrowText>Sentiment Trend</EyebrowText>
        <p className="text-sm text-[#e5e7eb] italic leading-relaxed">{sentimentTrend}</p>
      </div>
    </div>
  );
}
