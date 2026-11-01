import { useEffect, useState } from 'react';
import { DURATION_PRESETS, MAX_DURATION_MIN, MIN_DURATION_MIN } from '@/types';
import { cx } from '@/utils/cx';

interface DurationPickerProps {
  value: number;
  onChange(minutes: number): void;
  error?: string | null;
}

const isPreset = (v: number) => (DURATION_PRESETS as readonly number[]).includes(v);

export function DurationPicker({ value, onChange, error }: DurationPickerProps) {
  const [custom, setCustom] = useState(!isPreset(value));
  const [text, setText] = useState(String(value));

  useEffect(() => {
    if (!custom) setText(String(value));
  }, [value, custom]);

  const chip = (active: boolean) =>
    cx(
      'h-10 min-w-[56px] rounded-xl px-3 text-sm font-medium tabular transition-colors',
      active ? 'bg-ink text-bg' : 'bg-raised text-muted hover:text-ink'
    );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Длительность рейса">
        {DURATION_PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={!custom && value === m}
            className={chip(!custom && value === m)}
            onClick={() => {
              setCustom(false);
              onChange(m);
            }}
          >
            {m}
            <span className="ml-1 text-[11px] opacity-60">мин</span>
          </button>
        ))}
        <div
          className={cx(
            'flex h-10 items-center rounded-xl pl-3 pr-2 text-sm transition-colors',
            custom ? 'bg-ink text-bg' : 'bg-raised text-muted hover:text-ink'
          )}
        >
          <button type="button" className="font-medium" onClick={() => setCustom(true)}>
            Своё
          </button>
          {custom && (
            <input
              autoFocus
              inputMode="numeric"
              aria-label="Своя длительность в минутах"
              className="ml-2 w-12 rounded-md bg-bg/15 px-1.5 py-0.5 text-center font-medium tabular text-inherit outline-none"
              value={text}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
                setText(digits);
                onChange(digits ? Number(digits) : NaN);
              }}
            />
          )}
          {custom && <span className="ml-1 text-[11px] opacity-60">мин</span>}
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-[13px] text-danger">{error}</p>
      ) : (
        custom && (
          <p className="mt-2 text-[13px] text-faint">
            От {MIN_DURATION_MIN} до {MAX_DURATION_MIN} минут.
          </p>
        )
      )}
    </div>
  );
}
