interface Props {
  findings: string[];
}

// Plain-English captions tied to the velocity chart. Amber bullet matches
// the design token used elsewhere for "things worth noticing."
export function ChartFindings({ findings }: Props) {
  if (!findings || findings.length === 0) return null;
  return (
    <ul className="mt-4 space-y-2">
      {findings.map((finding, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="w-1 h-1 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
          <span className="text-sm text-[#e5e7eb] leading-relaxed">{finding}</span>
        </li>
      ))}
    </ul>
  );
}
