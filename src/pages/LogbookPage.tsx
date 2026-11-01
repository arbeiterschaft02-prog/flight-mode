import { BookOpen, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { Stat } from '@/components/Stat';
import { useNow } from '@/hooks/useNow';
import { useAppStore } from '@/store/useAppStore';
import type { FlightOutcome, FlightRecord } from '@/types';
import { cx } from '@/utils/cx';
import { plural } from '@/utils/plural';
import { computeStats } from '@/utils/stats';
import { dayKey, formatDuration, formatTimeOfDay, relativeDayLabel } from '@/utils/time';

type Filter = 'all' | FlightOutcome;

const FILTER_LABEL: Record<Filter, string> = {
  all: 'Все',
  completed: 'Завершённые',
  interrupted: 'Прерванные'
};

function OutcomeBadge({ outcome }: { outcome: FlightOutcome }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium',
        outcome === 'completed' ? 'bg-success/10 text-success' : 'bg-raised text-muted'
      )}
    >
      <span className={cx('h-1.5 w-1.5 rounded-full', outcome === 'completed' ? 'bg-success' : 'bg-faint')} />
      {outcome === 'completed' ? 'Завершён' : 'Прерван'}
    </span>
  );
}

function Row({ record, onDelete }: { record: FlightRecord; onDelete(): void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="group grid grid-cols-[56px_64px_minmax(0,1fr)_150px_104px_96px] items-center gap-4 py-3.5 text-[14px]">
      <span className="tabular text-muted">{formatTimeOfDay(record.startedAt)}</span>
      <span className="text-[12px] tracking-wide text-faint">{record.flightNumber}</span>
      <span className="truncate font-medium" title={record.taskName}>
        {record.taskName}
      </span>
      <span className="tabular text-muted">
        {formatDuration(record.focusedMs)}
        <span className="text-faint"> / {formatDuration(record.plannedDurationMs)}</span>
      </span>
      <OutcomeBadge outcome={record.outcome} />
      <div className="flex justify-end">
        {confirming ? (
          <div className="flex gap-1" onMouseLeave={() => setConfirming(false)}>
            <Button size="sm" variant="danger" onClick={onDelete}>
              Удалить
            </Button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Удалить рейс ${record.flightNumber}`}
            onClick={() => setConfirming(true)}
            className="rounded-lg p-2 text-faint opacity-0 transition-opacity hover:bg-raised hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </li>
  );
}

export function LogbookPage() {
  const history = useAppStore((s) => s.history);
  const deleteRecord = useAppStore((s) => s.deleteRecord);
  const navigate = useAppStore((s) => s.navigate);
  const [filter, setFilter] = useState<Filter>('all');
  const now = useNow(60_000);
  const stats = useMemo(() => computeStats(history, now), [history, now]);

  const groups = useMemo(() => {
    const visible = filter === 'all' ? history : history.filter((r) => r.outcome === filter);
    const map = new Map<string, FlightRecord[]>();
    for (const r of visible) {
      const key = dayKey(r.startedAt);
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()];
  }, [history, filter]);

  return (
    <div className="animate-enter mx-auto max-w-[920px] px-12 pb-14 pt-2">
      <PageHeader
        eyebrow="История рейсов"
        title="Бортжурнал"
        description={
          history.length
            ? `${history.length} ${plural(history.length, 'рейс записан', 'рейса записано', 'рейсов записано')}`
            : undefined
        }
      />

      {history.length === 0 ? (
        <div className="mt-20 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-raised text-faint">
            <BookOpen size={22} />
          </div>
          <h2 className="mt-5 text-lg font-semibold">Пока нет ни одного рейса</h2>
          <p className="mt-2 max-w-sm text-[14px] text-muted">
            Каждый рейс — завершённый или прерванный — записывается сюда и хранится только на этом компьютере.
          </p>
          <Button variant="primary" className="mt-6" onClick={() => navigate('home')}>
            Спланировать первый рейс
          </Button>
        </div>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-4 gap-8 border-y border-line/60 py-6">
            <Stat label="Всего в фокусе" value={formatDuration(stats.totalFocusMs)} />
            <Stat label="Завершено" value={stats.completed} />
            <Stat label="Прервано" value={stats.interrupted} />
            <Stat
              label="Доля завершённых"
              value={stats.completionRate === null ? '—' : `${Math.round(stats.completionRate * 100)}%`}
            />
          </section>

          <div className="mt-8 flex gap-1" role="tablist" aria-label="Фильтр рейсов">
            {(['all', 'completed', 'interrupted'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={cx(
                  'h-8 rounded-lg px-3 text-[13px] font-medium transition-colors',
                  filter === f ? 'bg-raised text-ink' : 'text-muted hover:text-ink'
                )}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
          </div>

          {groups.length === 0 ? (
            <p className="mt-10 text-[14px] text-faint">
              {filter === 'completed' ? 'Завершённых рейсов пока нет.' : 'Прерванных рейсов пока нет.'}
            </p>
          ) : (
            groups.map(([key, records]) => (
              <section key={key} className="mt-8">
                <h2 className="label">{relativeDayLabel(records[0].startedAt, now)}</h2>
                <ul className="mt-2 divide-y divide-line/60 border-t border-line/60">
                  {records.map((r) => (
                    <Row key={r.id} record={r} onDelete={() => void deleteRecord(r.id)} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
