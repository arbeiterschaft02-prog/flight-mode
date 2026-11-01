import { BookOpen, Check, PlaneTakeoff } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/Button';
import { Stat } from '@/components/Stat';
import { useAppStore } from '@/store/useAppStore';
import { formatDuration, formatTimeOfDay } from '@/utils/time';

export function ArrivalPage() {
  const record = useAppStore((s) => s.arrival);
  const navigate = useAppStore((s) => s.navigate);

  useEffect(() => {
    if (!record) navigate('home');
  }, [record, navigate]);

  if (!record) return null;

  const completed = record.outcome === 'completed';
  return (
    <div className="animate-enter mx-auto flex min-h-full max-w-[680px] flex-col justify-center px-12 pb-16">
      <div
        className={
          completed
            ? 'flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success'
            : 'flex h-12 w-12 items-center justify-center rounded-full bg-raised text-muted'
        }
      >
        {completed ? <Check size={24} strokeWidth={2.25} /> : <PlaneTakeoff size={22} className="rotate-180" />}
      </div>

      <p className="label mt-7">
        {completed ? 'Прибытие' : 'Аварийная посадка'} · Рейс {record.flightNumber}
      </p>
      <h1 className="mt-3 text-[36px] font-semibold leading-tight tracking-[-0.02em]">
        {completed ? 'Добро пожаловать в пункт назначения.' : 'Вы сели раньше — и это нормально.'}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        {completed
          ? 'Вы взлетели с тем, что давно откладывали, и удержали курс до конца. В этом и есть весь смысл.'
          : `Вы всё равно провели ${formatDuration(record.focusedMs)} в сосредоточенной работе. Дозаправьтесь и взлетайте снова, когда будете готовы.`}
      </p>

      <div className="mt-9 rounded-xl2 border border-line/70 p-6">
        <div className="label">Задача</div>
        <div className="mt-1.5 text-[18px] font-medium">{record.taskName}</div>
        <div className="mt-6 grid grid-cols-4 gap-6 border-t border-line/60 pt-5">
          <Stat label="В фокусе" value={formatDuration(record.focusedMs)} />
          <Stat label="План" value={formatDuration(record.plannedDurationMs)} />
          <Stat label="Статус" value={completed ? 'Завершён' : 'Прерван'} />
          <Stat
            label="Турбулентность"
            value={record.turbulenceCount}
            hint={`${formatTimeOfDay(record.startedAt)}–${formatTimeOfDay(record.endedAt)}`}
          />
        </div>
      </div>

      <div className="mt-9 flex gap-3">
        <Button variant="primary" size="lg" icon={<PlaneTakeoff size={18} />} onClick={() => navigate('home')}>
          Новый рейс
        </Button>
        <Button variant="secondary" size="lg" icon={<BookOpen size={17} />} onClick={() => navigate('logbook')}>
          История рейсов
        </Button>
      </div>
    </div>
  );
}
