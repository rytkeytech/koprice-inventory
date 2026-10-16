type LogoProps = {
  /** Show the "Koprice / ENTERPRISE" wordmark next to the circle. */
  withWordmark?: boolean;
  /** Extra classes for the wordmark, e.g. "hidden sm:flex" to hide it on phones. */
  wordmarkClassName?: string;
  /** Height of the circle mark in pixels. */
  size?: number;
  className?: string;
};

// Koprice logo: orange circle, thin dark inner ring, bold "KP".
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="32" cy="32" r="32" fill="#f59e0b" />
      <circle
        cx="32"
        cy="32"
        r="27"
        fill="none"
        stroke="#12261a"
        strokeWidth="1.5"
      />
      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-outfit), Arial, sans-serif"
        fontWeight="800"
        fontSize="24"
        letterSpacing="-0.5"
        fill="#12261a"
      >
        KP
      </text>
    </svg>
  );
}

export function Logo({ withWordmark = true, size = 40, className, wordmarkClassName }: LogoProps) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 ${className ?? ""}`}
      role="img"
      aria-label="Koprice Enterprise"
    >
      <LogoMark size={size} />
      {withWordmark && (
        <span className={`flex-col leading-none ${wordmarkClassName ?? "flex"}`} aria-hidden="true">
          <span
            className="font-extrabold text-brand"
            style={{ fontSize: size * 0.55 }}
          >
            Koprice
          </span>
          <span
            className="mt-0.5 font-semibold tracking-[0.28em] text-muted"
            style={{ fontSize: Math.max(8, size * 0.22) }}
          >
            ENTERPRISE
          </span>
        </span>
      )}
    </span>
  );
}
