// Generic shimmer placeholder used while v2 generation is in flight.
// `height` controls vertical size; `lines` adds soft horizontal bars
// inside the card for a content silhouette.

interface Props {
  height?: string;
  lines?: number;
  className?: string;
}

export function SkeletonCard({ height = "h-32", lines = 2, className = "" }: Props) {
  return (
    <div className={`bg-[#13131f] border border-white/5 rounded-lg p-5 ${height} ${className} animate-pulse`}>
      <div className="space-y-3">
        <div className="h-3 w-24 rounded bg-white/5" />
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded bg-white/5"
            style={{ width: `${Math.max(40, 95 - i * 18)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
