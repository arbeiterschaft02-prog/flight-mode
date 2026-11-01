interface LogoProps {
  size?: number;
  withWordmark?: boolean;
}

/** Brand mark: a climbing aircraft over a horizon line. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <path d="M7 23.5h18" className="stroke-accent-ink" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      <path
        d="M9.2 18.6 21.4 9.8c.9-.6 2.1-.4 2.6.4.4.6.2 1.4-.4 1.8l-3.6 2.6.9 6.1-1.4 1-2.4-5.2-3.5 2.5.2 2.3-1 .7-1.4-2.8-2.8-1.3 1-.7 2.3.3Z"
        className="fill-accent-ink"
      />
    </svg>
  );
}

export function Logo({ size = 28, withWordmark = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={size} />
      {withWordmark && <span className="text-[15px] font-semibold tracking-tight text-ink">Flight Mode</span>}
    </div>
  );
}
