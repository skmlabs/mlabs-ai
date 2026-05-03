interface Props {
  summary: string;
}

// Splits the summary on the first sentence boundary so the lead line gets
// editorial weight (semibold, larger) and the rest reads as supporting prose.
function splitFirstSentence(text: string): { lead: string; rest: string } {
  const trimmed = text.trim();
  // Match through the first ./!/? followed by whitespace + the rest of the
  // text. [\s\S] in lieu of the `s` (dotAll) flag for pre-ES2018 targets.
  const m = /^([\s\S]+?[.!?])\s+([\s\S]+)$/.exec(trimmed);
  if (!m || !m[1] || !m[2]) return { lead: trimmed, rest: "" };
  return { lead: m[1], rest: m[2] };
}

export function ExecutiveBrief({ summary }: Props) {
  const { lead, rest } = splitFirstSentence(summary);
  return (
    <div className="bg-[#13131f] border-t-2 border-indigo-500/40 border-x border-b border-white/5 rounded-lg p-6">
      <p className="text-lg font-semibold text-white mb-3">{lead}</p>
      {rest ? <p className="text-base text-[#e5e7eb] leading-relaxed">{rest}</p> : null}
    </div>
  );
}
