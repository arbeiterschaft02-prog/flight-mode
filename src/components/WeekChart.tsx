import { useState } from 'react';
import type { DayTotal } from '@/utils/stats';
import { count } from '@/utils/plural';
import { formatDuration, UI_LOCALE, weekdayShort } from '@/utils/time';
import { cx } from '@/utils/cx';

interface WeekChartProps {
  days: DayTotal[];
  todayKey: string;
}

/** Single-series bar chart of focused time per day, with a per-bar tooltip. */
export function WeekChart({ days, todayKey }: WeekChartProps) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...days.map((d) => d.focusMs), 1);
  const hasData = days.some((d) => d.focusMs > 0);

  return (
    <div>
      <div className="relative flex h-44 items-end gap-3 border-b border-line">
        {!hasData && (
          <p className="absolute inset-0 flex items-center justify-center text-[13px] text-faint">
            За последние {days.length} дней фокус-времени пока нет.
          </p>
        )}
        {days.map((d) => {
          const pct = (d.focusMs / max) * 100;
          const isToday = d.key === todayKey;
          const active = hover === d.key;
          return (
            <div
              key={d.key}
              className="relative flex h-full flex-1 cursor-default items-end justify-center"
              onMouseEnter={() => setHover(d.key)}
              onMouseLeave={() => setHover(null)}
              aria-label={`${new Date(d.start).toLocaleDateString(UI_LOCALE, { weekday: 'long' })}: ${formatDuration(d.focusMs)}`}
            >
              {active && (
                <div className="panel pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap px-3 py-2 text-[12px] shadow-lg">
                  <div className="text-faint">
                    {new Date(d.start).toLocaleDateString(UI_LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </div>
                  <div className="mt-0.5 font-medium tabular text-ink">
                    {formatDuration(d.focusMs)} · {count(d.flights, 'рейс', 'рейса', 'рейсов')}
                  </div>
                </div>
              )}
              {isToday && d.focusMs > 0 && !active && (
                <span
                  className="absolute text-[11px] font-medium tabular text-muted"
                  style={{ bottom: `calc(${pct}% + 6px)` }}
                >
                  {formatDuration(d.focusMs)}
                </span>
              )}
              <div
                className={cx(
                  'w-full max-w-[44px] rounded-t transition-[height,opacity]',
                  d.focusMs > 0 ? 'bg-accent' : 'bg-line',
                  hover && !active && 'opacity-50'
                )}
                style={{ height: d.focusMs > 0 ? `max(${pct}%, 4px)` : '2px' }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3">
        {days.map((d) => (
          <div
            key={d.key}
            className={cx('flex-1 text-center text-[11px] tracking-wide', d.key === todayKey ? 'font-medium text-ink' : 'text-faint')}
          >
            {d.key === todayKey ? 'Сегодня' : weekdayShort(d.start)}
          </div>
        ))}
      </div>
    </div>
  );
}
