import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  size?: 'md' | 'lg';
}

/** Instrument-style readout: small caption over a large tabular value. */
export function Stat({ label, value, hint, size = 'md' }: StatProps) {
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div
        className={cx(
          'mt-1.5 truncate font-semibold tabular tracking-tight text-ink',
          size === 'lg' ? 'text-[32px] leading-none' : 'text-[22px] leading-tight'
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[12px] text-faint">{hint}</div>}
    </div>
  );
}
