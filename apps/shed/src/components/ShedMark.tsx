/** Shed icon: top of a Nutrition Facts label in the Horse Pocket clipped-corner frame. */
export function ShedMark({ className = 'shed-mark-svg' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <polygon fill="var(--shed-outline)" points="4,12 12,4 52,4 60,12 60,52 52,60 12,60 4,52" />
      <path fill="var(--shed-fill)" d="M8 12 L12 8 L52 8 L56 12 L56 52 L52 56 L12 56 L8 52 Z" />
      <rect fill="var(--shed-outline)" x="10" y="19" width="44" height="6" />
      <rect fill="var(--shed-outline)" x="10" y="32" width="44" height="6" />
      <rect fill="var(--shed-outline)" x="10" y="41" width="44" height="2" />
      <rect fill="var(--shed-outline)" x="10" y="46" width="44" height="2" />
      <rect fill="var(--shed-outline)" x="10" y="50" width="44" height="2" />
    </svg>
  );
}
