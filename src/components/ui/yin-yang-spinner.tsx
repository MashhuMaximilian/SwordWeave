/**
 * Yin-yang spinner — counter-clockwise rotation.
 *
 * Visual: a small triple-yin (interlocked circles) icon from
 * game-icons.net (lorc/triple-yin), spinning 45rpm counter-clockwise.
 * Used as the loading state for bundle fetches inside the character
 * modal — small, non-distracting, clearly rotating, and matches the
 * rest of the game's icon vocabulary (game-icons.net is the canonical
 * source for our other UI icons).
 *
 * If you'd prefer a different icon set (Lucide, etc.), swap the SVG
 * path — the wrapper API (size, className, label) is stable.
 */
export function YinYangSpinner({
  size = 24,
  className,
  label = "Loading…",
}: {
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={"inline-flex items-center gap-2 " + (className ?? "")}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        aria-hidden="true"
        className="animate-spin"
        style={{ animationDuration: "1.333s" /* 45 rpm */ }}
      >
        {/* Triple Yin — three interlocked yin-yang discs in a
            trefoil arrangement, from game-icons.net (lorc). Scaled
            to a 24×24 viewBox so the swirl stays readable at small
            sizes. */}
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth={20}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* outer ring */}
          <circle cx="256" cy="256" r="220" />
          {/* top disc */}
          <circle cx="256" cy="120" r="60" />
          <path d="M 256 60 a 60 60 0 0 1 0 120 a 30 30 0 0 0 0 -60 a 30 30 0 0 1 0 -60" fill="currentColor" />
          {/* bottom-left disc */}
          <circle cx="170" cy="332" r="60" />
          <path d="M 170 272 a 60 60 0 0 1 0 120 a 30 30 0 0 0 0 -60 a 30 30 0 0 1 0 -60" fill="currentColor" />
          {/* bottom-right disc */}
          <circle cx="342" cy="332" r="60" />
          <path d="M 342 272 a 60 60 0 0 1 0 120 a 30 30 0 0 0 0 -60 a 30 30 0 0 1 0 -60" fill="currentColor" />
        </g>
      </svg>
      {label ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
    </span>
  );
}