export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-label="MyChamaa" role="img">
      <g transform="translate(24 20) scale(.82)" fill="var(--pig)">
        <ellipse cx="124" cy="136" rx="92" ry="74" />
        <path d="M164 74 L190 44 L196 92 Z" />
        <rect x="200" y="114" width="34" height="42" rx="12" />
        <rect x="66" y="186" width="28" height="44" rx="8" />
        <rect x="148" y="186" width="28" height="44" rx="8" />
        <rect fill="var(--surface)" x="100" y="70" width="44" height="10" rx="5" />
        <path d="M124 140 A7 7 0 0 1 138 140 A14 14 0 0 1 110 140 A21 21 0 0 1 152 140 A28 28 0 0 1 96 140 A35 35 0 0 1 166 140" fill="none" stroke="var(--lime)" strokeWidth="9" strokeLinecap="round" />
      </g>
    </svg>
  );
}
