import { AppWindow, ArrowLeft, Globe, PlaneTakeoff, ShieldAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import { Dialog } from '@/components/Dialog';
import { DurationPicker } from '@/components/DurationPicker';
import { ListEditor } from '@/components/ListEditor';
import { Toggle } from '@/components/Toggle';
import { useNow } from '@/hooks/useNow';
import { useAppStore } from '@/store/useAppStore';
import { MAX_TASK_LENGTH } from '@/types';
import { normalizeDomain, normalizeExeName } from '@/utils/domains';
import { validateDuration, validateTaskName } from '@/utils/flight';
import { count, plural } from '@/utils/plural';
import { formatTimeOfDay } from '@/utils/time';

function CheckRow(props: {
  icon: ReactNode;
  title: string;
  summary: string;
  checked: boolean;
  onToggle(v: boolean): void;
  editing: boolean;
  onEdit(): void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="py-5">
      <div className="flex items-center gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-raised text-muted">{props.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium">{props.title}</div>
          <div className="mt-0.5 truncate text-[13px] text-muted">{props.summary}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={props.onEdit}>
          {props.editing ? 'Готово' : 'Изменить список'}
        </Button>
        <Toggle label={props.title} checked={props.checked} onChange={props.onToggle} disabled={props.disabled} />
      </div>
      {props.editing && <div className="ml-[52px] mt-4">{props.children}</div>}
    </div>
  );
}

export function PreparationPage() {
  const draft = useAppStore((s) => s.draft);
  const setDraft = useAppStore((s) => s.setDraft);
  const settings = useAppStore((s) => s.settings)!;
  const updateSettings = useAppStore((s) => s.updateSettings);
  const takeOff = useAppStore((s) => s.takeOff);
  const departing = useAppStore((s) => s.departing);
  const navigate = useAppStore((s) => s.navigate);
  const isWindows = navigator.userAgent.includes('Windows');

  const [blockSites, setBlockSites] = useState(settings.blockSitesByDefault && settings.blockedSites.length > 0);
  const [blockApps, setBlockApps] = useState(isWindows && settings.blockAppsByDefault && settings.blockedApps.length > 0);  const [editing, setEditing] = useState<'sites' | 'apps' | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const now = useNow(15_000);

  const duration = validateDuration(draft.durationMin);
  const arrival = now + (duration.ok ? duration.value : 0) * 60_000;

  const depart = async (sites: boolean) => {
    setConsentOpen(false);
    await takeOff({ blockSites: sites, blockApps });
  };

  const onStart = () => {
    const task = validateTaskName(draft.taskName);
    setTaskError(task.ok ? null : task.error);
    setDurationError(duration.ok ? null : duration.error);
    if (!task.ok || !duration.ok) return;
    if (blockSites && !settings.hostsConsent) {
      setConsentOpen(true);
      return;
    }
    void depart(blockSites);
  };

  const grantConsentAndDepart = async () => {
    const updated = await updateSettings({ hostsConsent: true });
    if (updated) await depart(true);
  };

  const siteCount = settings.blockedSites.length;
  const appCount = settings.blockedApps.length;

  return (
    <div className="animate-enter mx-auto max-w-[760px] px-12 pb-14 pt-2">
      <button
        type="button"
        onClick={() => navigate('home')}
        className="-ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] text-muted hover:text-ink"
      >
        <ArrowLeft size={15} /> Назад
      </button>

      <p className="label mt-6">Предполётная проверка</p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Подготовка к вылету</h1>

      {/* Boarding pass */}
      <section className="panel mt-7 overflow-hidden">
        <div className="p-6">
          <label htmlFor="prep-task" className="label">
            Задача
          </label>
          <input
            id="prep-task"
            className="mt-2 w-full bg-transparent text-[22px] font-semibold tracking-tight text-ink outline-none placeholder:text-faint"
            value={draft.taskName}
            maxLength={MAX_TASK_LENGTH + 20}
            placeholder="Назовите задачу"
            onChange={(e) => {
              setDraft({ taskName: e.target.value });
              setTaskError(null);
            }}
          />
          {taskError && <p className="mt-1 text-[13px] text-danger">{taskError}</p>}
          <div className="mt-6">
            <DurationPicker
              value={draft.durationMin}
              error={durationError}
              onChange={(m) => {
                setDraft({ durationMin: m });
                setDurationError(null);
              }}
            />
          </div>
        </div>
        {/* Perforation */}
        <div className="relative border-t border-dashed border-line">
          <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full bg-bg" />
          <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full bg-bg" />
        </div>
        <div className="grid grid-cols-3 gap-6 px-6 py-5">
          <div>
            <div className="label">Откуда</div>
            <div className="mt-1 text-[15px] font-medium">Сейчас · {formatTimeOfDay(now)}</div>
          </div>
          <div className="text-center">
            <div className="label">Время полёта</div>
            <div className="mt-1 text-[15px] font-medium tabular">{duration.ok ? `${duration.value} мин` : '—'}</div>
          </div>
          <div className="text-right">
            <div className="label">Куда</div>
            <div className="mt-1 text-[15px] font-medium">Готово · {duration.ok ? formatTimeOfDay(arrival) : '—'}</div>
          </div>
        </div>
      </section>

      <section className="mt-8 divide-y divide-line/60 border-y border-line/60">
        <CheckRow
          icon={<Globe size={17} />}
          title="Блокировать отвлекающие сайты"
          summary={
            siteCount
              ? `${count(siteCount, 'сайт', 'сайта', 'сайтов')} · ${settings.blockedSites.slice(0, 4).join(', ')}${siteCount > 4 ? '…' : ''}`
              : 'Список пуст — добавьте сайт, чтобы включить блокировку'
          }
          checked={blockSites && siteCount > 0}
          disabled={siteCount === 0}
          onToggle={setBlockSites}
          editing={editing === 'sites'}
          onEdit={() => setEditing(editing === 'sites' ? null : 'sites')}
        >
          <ListEditor
            items={settings.blockedSites}
            onChange={(blockedSites) => {
              void updateSettings({ blockedSites });
              if (blockedSites.length === 0) setBlockSites(false);
            }}
            normalize={normalizeDomain}
            placeholder="Добавьте домен, например vk.com"
            invalidMessage="Это не похоже на адрес сайта."
            emptyMessage="В списке нет сайтов."
          />
        </CheckRow>
        <CheckRow
          icon={<AppWindow size={17} />}
          title="Закрывать отвлекающие приложения"
          summary={
            !isWindows
              ? 'Доступно в Windows'
              : appCount
                ? `Закрывает ${settings.blockedApps.slice(0, 4).join(', ')}${appCount > 4 ? '…' : ''}, если они запущены`
                : 'Список пуст — добавьте приложение, чтобы включить'
          }
          checked={blockApps && appCount > 0}
          disabled={!isWindows || appCount === 0}
          onToggle={setBlockApps}
          editing={editing === 'apps'}
          onEdit={() => setEditing(editing === 'apps' ? null : 'apps')}
        >
          <ListEditor
            items={settings.blockedApps}
            onChange={(blockedApps) => {
              void updateSettings({ blockedApps });
              if (blockedApps.length === 0) setBlockApps(false);
            }}
            normalize={normalizeExeName}
            placeholder="Добавьте программу, например Discord.exe"
            invalidMessage="Укажите имя файла программы, например Discord.exe."
            emptyMessage="В списке нет приложений."
          />
          <p className="mt-3 text-[12px] leading-relaxed text-faint">
            Программы из списка принудительно закрываются, если запущены во время полёта. Несохранённые данные в них
            теряются.
          </p>
        </CheckRow>
      </section>

      <div className="mt-9 flex items-center gap-5">
        <Button variant="primary" size="lg" icon={<PlaneTakeoff size={18} />} loading={departing} onClick={onStart}>
          {departing ? 'Готовимся к вылету…' : 'Начать полёт'}
        </Button>
        {departing && blockSites && (
          <span className="text-[13px] text-muted">Windows может запросить разрешение на блокировку сайтов.</span>
        )}
      </div>

      <Dialog
        open={consentOpen}
        onClose={() => setConsentOpen(false)}
        title="Разрешить блокировку сайтов?"
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <ShieldAlert size={20} />
          </div>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => void depart(false)}>
              Лететь без блокировки
            </Button>
            <Button variant="primary" data-autofocus onClick={() => void grantConsentAndDepart()}>
              Разрешить и взлететь
            </Button>
          </>
        }
      >
        <p>
          Чтобы блокировать сайты во всех браузерах, Flight Mode добавляет помеченный раздел в системный файл Windows{' '}
          <span className="font-medium text-ink">hosts</span>, который делает {siteCount}{' '}
          {plural(siteCount, 'сайт', 'сайта', 'сайтов')} из вашего списка недоступными.
        </p>
        <p className="mt-3">
          Windows запросит права администратора. Раздел удаляется автоматически после посадки, а также его можно удалить
          в любой момент в настройках.
        </p>
      </Dialog>
    </div>
  );
}
