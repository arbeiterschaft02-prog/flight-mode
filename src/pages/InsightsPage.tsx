import { useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Stat } from '@/components/Stat';
import { WeekChart } from '@/components/WeekChart';
import { useNow } from '@/hooks/useNow';
import { useAppStore } from '@/store/useAppStore';
import { count, plural } from '@/utils/plural';
import { computeStats } from '@/utils/stats';
import { dayKey, formatDuration } from '@/utils/time';

export function InsightsPage() {
  const history = useAppStore((s) => s.history);
  const now = useNow(60_000);
  const stats = useMemo(() => computeStats(history, now), [history, now]);
  const weekMs = stats.lastDays.reduce((sum, d) => sum + d.focusMs, 0);
  const total = stats.completed + stats.interrupted;

  return (
    <div className="animate-enter mx-auto max-w-[920px] px-12 pb-14 pt-2">
      <PageHeader eyebrow="Продуктивность" title="Статистика" description="Сколько вы на самом деле налетали." />

      <section className="mt-10 grid grid-cols-3 gap-10">
        <Stat size="lg" label="Фокус за неделю" value={formatDuration(weekMs)} hint="последние 7 дней" />
        <Stat
          size="lg"
          label="Сегодня"
          value={formatDuration(stats.today.focusMs)}
          hint={`${stats.today.completed} ${plural(stats.today.completed, 'завершён', 'завершено', 'завершено')}`}
        />
        <Stat
          size="lg"
          label="Серия"
          value={count(stats.streakDays, 'день', 'дня', 'дней')}
          hint={stats.streakDays ? 'подряд с завершённым рейсом' : 'завершите рейс сегодня, чтобы начать'}
        />
      </section>

      <section className="mt-12">
        <h2 className="label mb-6">Время в фокусе · последние 7 дней</h2>
        <WeekChart days={stats.lastDays} todayKey={dayKey(now)} />
      </section>

      <section className="mt-12 grid grid-cols-4 gap-8 border-t border-line/60 pt-8">
        <Stat label="Фокус за всё время" value={formatDuration(stats.totalFocusMs)} />
        <Stat
          label="Доля завершённых"
          value={stats.completionRate === null ? '—' : `${Math.round(stats.completionRate * 100)}%`}
          hint={`${stats.completed} из ${count(total, 'рейса', 'рейсов', 'рейсов')}`}
        />
        <Stat label="Средний рейс" value={stats.averageFocusMs ? formatDuration(stats.averageFocusMs) : '—'} />
        <Stat label="Самый долгий рейс" value={stats.longestFocusMs ? formatDuration(stats.longestFocusMs) : '—'} />
      </section>
    </div>
  );
}
