import { AppWindow, Globe, Pause, Play, RotateCw, TriangleAlert, Wind, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRestartButton } from '@/components/BrowserRestartButton';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { FlightPath } from '@/components/FlightPath';
import { useFlightClock } from '@/hooks/useFlightClock';
import { getApi } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import type { FlightPhase } from '@/utils/flight';
import { cx } from '@/utils/cx';
import { count } from '@/utils/plural';
import { formatClock, formatDuration } from '@/utils/time';

const PHASE_LABEL: Record<FlightPhase, string> = {
  takeoff: 'Взлёт',
  climb: 'Набор высоты',
  cruise: 'Крейсерский полёт',
  descent: 'Снижение',
  approach: 'Заход на посадку',
  holding: 'Зона ожидания'
};

const CRUISE_LINES = [
  'Вы в полёте. Всё остальное подождёт.',
  'Одна задача. Один пункт назначения.',
  'Турбулентность проходит. Держите курс.',
  'Самое трудное — взлететь. Вы уже это сделали.',
  'Ровная высота. Продолжайте.'
];

function messageFor(phase: FlightPhase, elapsedMs: number): string {
  switch (phase) {
    case 'takeoff':
      return 'Взлёт разрешён. Устраивайтесь поудобнее.';
    case 'climb':
      return 'Набираем высоту. Первые минуты — самые трудные.';
    case 'descent':
      return 'Начинаем снижение. Финишируйте уверенно.';
    case 'approach':
      return 'Заход на посадку. Доведите дело до конца.';
    case 'holding':
      return 'Зона ожидания. Продолжите, когда будете готовы.';
    case 'cruise':
      // Rotate slowly — a new line every four minutes, never a flicker.
      return CRUISE_LINES[Math.floor(elapsedMs / 240_000) % CRUISE_LINES.length];
  }
}

function StatusItem({ icon, tone, children }: { icon: ReactNode; tone: 'ok' | 'off' | 'warn'; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span className={cx(tone === 'ok' ? 'text-success' : tone === 'warn' ? 'text-warn' : 'text-faint')}>{icon}</span>
      <span className={tone === 'off' ? 'text-faint' : 'text-muted'}>{children}</span>
    </div>
  );
}

export function InFlightPage() {
  const flight = useAppStore((s) => s.activeFlight);
  const pause = useAppStore((s) => s.pause);
  const resume = useAppStore((s) => s.resume);
  const emergencyLanding = useAppStore((s) => s.emergencyLanding);
  const clock = useFlightClock(flight);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [landing, setLanding] = useState(false);
  const [restartHintClosed, setRestartHintClosed] = useState(false);
  const [browsers, setBrowsers] = useState<string[]>([]);
  useEffect(() => {
    void getApi()
      .getRunningBrowsers()
      .then(setBrowsers)
      .catch(() => setBrowsers([]));
  }, []);

  if (!flight || !clock) return null;
  const b = flight.blocking;
  const turbulence = flight.turbulence.length;

  const land = async () => {
    setLanding(true);
    await emergencyLanding();
    setLanding(false);
    setConfirmOpen(false);
  };

  return (
    <div className="animate-enter mx-auto flex min-h-full max-w-[880px] flex-col px-12 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={cx('h-2 w-2 rounded-full', clock.paused ? 'bg-warn' : 'bg-success')} />
          <span className="label !text-ink">{clock.paused ? 'Ожидание' : 'Вы в полёте'}</span>
          <span className="label">· Рейс {flight.flightNumber}</span>
        </div>
        <span className="label">{PHASE_LABEL[clock.phase]}</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
        <p className="label">Пункт назначения</p>
        <h1 className="mt-3 max-w-[640px] text-[26px] font-semibold leading-snug tracking-tight">{flight.taskName}</h1>

        <div
          className={cx(
            'mt-8 font-light tabular leading-none tracking-[-0.04em] transition-opacity',
            clock.remaining >= 3_600_000 ? 'text-[104px]' : 'text-[128px]',
            clock.paused && 'opacity-50'
          )}
          aria-live="off"
        >
          {formatClock(clock.remaining)}
        </div>
        <p className="mt-4 h-5 text-[15px] text-muted">{messageFor(clock.phase, clock.elapsed)}</p>

        <div className="mt-10 w-full">
          <FlightPath progress={clock.progress} departureAt={flight.startedAt} arrivalAt={clock.eta} paused={clock.paused} />
        </div>
      </div>

      {b.sitesActive && !restartHintClosed && (
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-raised/60 p-4 text-left text-[13px] leading-relaxed text-muted">
          <RotateCw size={16} className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <span className="font-medium text-ink">Сайт из списка всё ещё открывается?</span> Браузер, который давно не
            перезапускали, может не замечать блокировку. Перезапустите его — окна и вкладки сохранятся.
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <BrowserRestartButton browsers={browsers} />
            <button
              type="button"
              aria-label="Скрыть подсказку"
              onClick={() => setRestartHintClosed(true)}
              className="rounded-lg p-1.5 text-faint hover:text-ink"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-6 border-t border-line/60 pt-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {b.sitesActive ? (
            <StatusItem icon={<Globe size={15} />} tone="ok">
              Заблокировано: {count(b.sitesCount, 'сайт', 'сайта', 'сайтов')}
            </StatusItem>
          ) : b.sitesRequested ? (
            <StatusItem icon={<TriangleAlert size={15} />} tone="warn">
              <span title={b.sitesError ?? undefined}>Сайты не заблокированы</span>
            </StatusItem>
          ) : (
            <StatusItem icon={<Globe size={15} />} tone="off">
              Блокировка сайтов выкл.
            </StatusItem>
          )}
          {b.appsActive ? (
            <StatusItem icon={<AppWindow size={15} />} tone="ok">
              Под контролем: {count(b.appsCount, 'приложение', 'приложения', 'приложений')}
            </StatusItem>
          ) : (
            <StatusItem icon={<AppWindow size={15} />} tone="off">
              Блокировка приложений выкл.
            </StatusItem>
          )}
          <StatusItem icon={<Wind size={15} />} tone={turbulence ? 'warn' : 'off'}>
            {turbulence ? `Турбулентность ×${turbulence}` : 'Спокойный воздух'}
          </StatusItem>
          <span className="text-[13px] tabular text-faint">В полёте {formatDuration(clock.elapsed)}</span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {clock.paused ? (
            <Button variant="primary" icon={<Play size={15} />} onClick={() => void resume()}>
              Продолжить
            </Button>
          ) : (
            <Button variant="ghost" icon={<Pause size={15} />} onClick={() => void pause()}>
              Пауза
            </Button>
          )}
          <Button variant="danger-ghost" onClick={() => setConfirmOpen(true)}>
            Аварийная посадка
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Запросить аварийную посадку?"
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
            <TriangleAlert size={20} />
          </div>
        }
        actions={
          <>
            <Button variant="danger-ghost" loading={landing} onClick={() => void land()}>
              Сесть сейчас
            </Button>
            <Button variant="primary" data-autofocus onClick={() => setConfirmOpen(false)}>
              Продолжить полёт
            </Button>
          </>
        }
      >
        <p>
          Рейс будет записан в бортжурнал как <span className="font-medium text-ink">прерванный</span>, с фокусом{' '}
          {formatDuration(clock.elapsed)}. {b.sitesActive && 'Блокировка сайтов будет снята.'}
        </p>
        <p className="mt-3">
          {clock.remaining > 60_000
            ? `До пункта назначения осталось ${formatDuration(clock.remaining)}.`
            : 'До пункта назначения меньше минуты.'}
        </p>
      </Dialog>
    </div>
  );
}
