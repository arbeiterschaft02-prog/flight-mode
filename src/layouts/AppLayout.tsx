import { BarChart3, BookOpen, Navigation, Plane, Settings as SettingsIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/Logo';
import { useFlightClock } from '@/hooks/useFlightClock';
import { useAppStore, type Page } from '@/store/useAppStore';
import { cx } from '@/utils/cx';
import { formatClock } from '@/utils/time';

const NAV: Array<{ page: Page; label: string; icon: typeof Plane }> = [
  { page: 'home', label: 'Вылет', icon: Navigation },
  { page: 'logbook', label: 'Бортжурнал', icon: BookOpen },
  { page: 'insights', label: 'Статистика', icon: BarChart3 },
  { page: 'settings', label: 'Настройки', icon: SettingsIcon }
];

function InFlightBadge() {
  const flight = useAppStore((s) => s.activeFlight);
  const page = useAppStore((s) => s.page);
  const navigate = useAppStore((s) => s.navigate);
  const clock = useFlightClock(flight);
  if (!flight || !clock) return null;
  const current = page === 'flight';
  return (
    <button
      type="button"
      onClick={() => navigate('flight')}
      className={cx(
        'no-drag w-full rounded-xl border px-3.5 py-3 text-left transition-colors',
        current ? 'border-accent/40 bg-accent/10' : 'border-line/70 bg-surface hover:border-accent/40'
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cx('h-1.5 w-1.5 rounded-full', clock.paused ? 'bg-warn' : 'bg-success')} />
        <span className="label !text-[10px]">{clock.paused ? 'Ожидание' : 'В полёте'}</span>
        <span className="ml-auto text-[11px] text-faint">{flight.flightNumber}</span>
      </div>
      <div className="mt-1.5 text-[20px] font-semibold tabular leading-none tracking-tight">
        {formatClock(clock.remaining)}
      </div>
      <div className="mt-1 truncate text-[12px] text-muted">{flight.taskName}</div>
      <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent" style={{ width: `${clock.progress * 100}%` }} />
      </div>
    </button>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const page = useAppStore((s) => s.page);
  const navigate = useAppStore((s) => s.navigate);
  const inFlight = useAppStore((s) => s.activeFlight !== null);
  const flightPages: Page[] = ['home', 'prepare', 'flight', 'arrival'];

  return (
    <div className="flex h-full">
      <aside className="drag flex w-[232px] shrink-0 flex-col border-r border-line/60 bg-surface/40 px-4 pb-4 pt-5">
        <div className="no-drag px-2">
          <Logo />
        </div>
        <nav className="no-drag mt-9 flex flex-col gap-0.5" aria-label="Главное меню">
          {NAV.map(({ page: target, label, icon: Icon }) => {
            const active = target === 'home' ? flightPages.includes(page) : page === target;
            const text = target === 'home' && inFlight ? 'Кабина' : label;
            const ItemIcon = target === 'home' && inFlight ? Plane : Icon;
            return (
              <button
                key={target}
                type="button"
                onClick={() => navigate(target)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors',
                  active ? 'bg-raised text-ink' : 'text-muted hover:bg-raised/60 hover:text-ink'
                )}
              >
                <ItemIcon size={17} strokeWidth={1.75} className={active ? 'text-accent' : ''} />
                {text}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto">
          <InFlightBadge />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Draggable title strip; Windows caption buttons are overlaid on the right. */}
        <div className="drag h-11 shrink-0" />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
