import { ArrowRight, CheckCircle2, CircleSlash } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/Button';
import { DurationPicker } from '@/components/DurationPicker';
import { Stat } from '@/components/Stat';
import { useNow } from '@/hooks/useNow';
import { useAppStore } from '@/store/useAppStore';
import { MAX_TASK_LENGTH } from '@/types';
import { validateDuration, validateTaskName } from '@/utils/flight';
import { count, plural } from '@/utils/plural';
import { computeStats } from '@/utils/stats';
import { formatDuration, formatTimeOfDay, greeting } from '@/utils/time';

export function HomePage() {
  const draft = useAppStore((s) => s.draft);
  const setDraft = useAppStore((s) => s.setDraft);
  const navigate = useAppStore((s) => s.navigate);
  const history = useAppStore((s) => s.history);
  const now = useNow(30_000);
  const stats = useMemo(() => computeStats(history, now), [history, now]);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const task = validateTaskName(draft.taskName);
    const duration = validateDuration(draft.durationMin);
    setTaskError(task.ok ? null : task.error);
    setDurationError(duration.ok ? null : duration.error);
    if (!task.ok || !duration.ok) return;
    setDraft({ taskName: task.value, durationMin: duration.value });
    navigate('prepare');
  };

  const recent = history.slice(0, 3);

  return (
    <div className="animate-enter mx-auto flex max-w-[760px] flex-col px-12 pb-14 pt-6">
      <p className="label">{greeting(now)}</p>
      <h1 className="mt-3 text-[40px] font-semibold leading-[1.1] tracking-[-0.025em]">
        Что вы давно
        <br />
        откладываете?
      </h1>
      <p className="mt-3 text-[15px] text-muted">Хватит откладывать. Взлетайте. Доводите важное до конца.</p>

      <form onSubmit={submit} className="mt-10" noValidate>
        <label htmlFor="task" className="label">
          Пункт назначения
        </label>
        <input
          id="task"
          autoFocus
          className="input mt-2.5 h-14 text-[17px]"
          placeholder="Например: написать черновик отчёта"
          maxLength={MAX_TASK_LENGTH + 20}
          value={draft.taskName}
          aria-invalid={!!taskError}
          onChange={(e) => {
            setDraft({ taskName: e.target.value });
            if (taskError) setTaskError(null);
          }}
        />
        {taskError && <p className="mt-2 text-[13px] text-danger">{taskError}</p>}

        <div className="label mt-7">Время полёта</div>
        <div className="mt-2.5">
          <DurationPicker
            value={draft.durationMin}
            error={durationError}
            onChange={(m) => {
              setDraft({ durationMin: m });
              if (durationError) setDurationError(null);
            }}
          />
        </div>

        <div className="mt-9 flex items-center gap-4">
          <Button type="submit" variant="primary" size="lg" trailingIcon={<ArrowRight size={18} />}>
            Взлететь
          </Button>
          <span className="text-[13px] text-faint">или нажмите Enter</span>
        </div>
      </form>

      <section className="mt-14 border-t border-line/70 pt-8" aria-label="Сегодня">
        <div className="grid grid-cols-3 gap-8">
          <Stat
            label="Рейсов сегодня"
            value={stats.today.completed}
            hint={stats.today.interrupted ? `${stats.today.interrupted} прервано` : plural(stats.today.completed, 'завершён', 'завершено', 'завершено')}
          />
          <Stat label="Фокус сегодня" value={formatDuration(stats.today.focusMs)} hint={`${formatDuration(stats.totalFocusMs)} за всё время`} />
          <Stat
            label="Серия"
            value={count(stats.streakDays, 'день', 'дня', 'дней')}
            hint={stats.streakDays ? 'Не прерывайте её' : 'Завершите рейс, чтобы начать'}
          />
        </div>

        <div className="mt-10">
          <div className="flex items-baseline justify-between">
            <h2 className="label">Последние рейсы</h2>
            {history.length > 0 && (
              <button type="button" className="text-[13px] text-muted hover:text-ink" onClick={() => navigate('logbook')}>
                Открыть бортжурнал
              </button>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="mt-4 text-[14px] text-faint">
              Бортжурнал пока пуст. До первого рейса — одна задача и один клик.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-line/60">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center gap-4 py-3 text-[14px]">
                  {r.outcome === 'completed' ? (
                    <CheckCircle2 size={16} className="shrink-0 text-success" aria-label="Завершён" />
                  ) : (
                    <CircleSlash size={16} className="shrink-0 text-faint" aria-label="Прерван" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{r.taskName}</span>
                  <span className="tabular text-muted">{formatDuration(r.focusedMs)}</span>
                  <span className="w-14 text-right tabular text-faint">{formatTimeOfDay(r.startedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
