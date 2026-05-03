import type { Theme, ThemeSentiment } from "@/lib/types/aiInsights";

interface Props {
  theme: Theme;
}

const SENTIMENT_PILL: Record<ThemeSentiment, string> = {
  positive: "bg-green-500/10 text-green-400 border-green-500/25",
  mixed: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  negative: "bg-red-500/10 text-red-400 border-red-500/25",
};

export function ThemeCard({ theme }: Props) {
  const pillClass = SENTIMENT_PILL[theme.sentiment] ?? SENTIMENT_PILL.mixed;
  return (
    <div className="bg-[#13131f] border border-white/5 rounded-lg p-5">
      <div className="flex justify-between items-start gap-3">
        <h3 className="text-base font-semibold text-white">{theme.name}</h3>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${pillClass}`}>
          {theme.sentiment}
        </span>
      </div>
      <div className="text-xs text-[#9ca3af] mt-1 mb-3">{theme.frequency}</div>
      <p className="text-sm text-[#e5e7eb] leading-relaxed mb-4">{theme.description}</p>
      {theme.evidence && theme.evidence.length > 0 ? (
        <div className="border-t border-white/5 pt-3 space-y-2">
          {theme.evidence.map((ev, i) => (
            <div key={i}>
              <div className="text-xs font-semibold text-white">{ev.reviewer}</div>
              <div className="text-xs text-[#9ca3af] italic mt-0.5">&ldquo;{ev.quote}&rdquo;</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
