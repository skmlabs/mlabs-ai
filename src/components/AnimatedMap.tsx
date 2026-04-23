"use client";

const PIN_POSITIONS = [
  { x: 15, y: 25, delay: 0 },
  { x: 35, y: 40, delay: 0.4 },
  { x: 55, y: 20, delay: 0.8 },
  { x: 75, y: 55, delay: 1.2 },
  { x: 25, y: 70, delay: 1.6 },
  { x: 65, y: 75, delay: 2.0 },
  { x: 85, y: 30, delay: 2.4 },
  { x: 45, y: 60, delay: 0.2 },
];

export function AnimatedMap() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0">
        <defs>
          <radialGradient id="bg-grad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#1a1a2e" stopOpacity="1" />
            <stop offset="60%" stopColor="#0f0f1a" stopOpacity="1" />
            <stop offset="100%" stopColor="#0a0a0f" stopOpacity="1" />
          </radialGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="100" height="100" fill="url(#bg-grad)" />
        {PIN_POSITIONS.map((pin, i) => (
          <g key={i} transform={`translate(${pin.x} ${pin.y})`}>
            <circle r="5" fill="none" stroke="#6366f1" strokeWidth="0.3" opacity="0.6">
              <animate attributeName="r" from="2" to="10" dur="3s" repeatCount="indefinite" begin={`${pin.delay}s`} />
              <animate attributeName="opacity" from="0.7" to="0" dur="3s" repeatCount="indefinite" begin={`${pin.delay}s`} />
            </circle>
            <circle r="1.3" fill="#6366f1" opacity="1" filter="url(#glow)" />
            <circle r="0.5" fill="#a5b4fc" opacity="1" />
          </g>
        ))}
      </svg>
    </div>
  );
}
