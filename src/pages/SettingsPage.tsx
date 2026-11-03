import { Monitor, Moon, Sun, Volume2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/Button';
import { DurationPicker } from '@/components/DurationPicker';
import { ListEditor } from '@/components/ListEditor';
import { PageHeader } from '@/components/PageHeader';
import { Toggle } from '@/components/Toggle';
import { getApi } from '@/services/api';
import { playChime } from '@/services/sound';
import { useAppStore } from '@/store/useAppStore';
import type { ThemePreference } from '@/types';
import { cx } from '@/utils/cx';
import { normalizeDomain, normalizeExeName } from '@/utils/domains';
import { validateDuration } from '@/utils/flight';

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[220px_minmax(0,1fr)] gap-10 border-t border-line/60 py-8">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {description && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Row({ title, hint, control }: { title: string; hint?: ReactNode; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <div className="text-[14px] font-medium">{title}</div>
        {hint && <div className="mt-0.5 text-[13px] text-muted">{hint}</div>}
      </div>
      {control}
    </div>
  );
}

const THEMES: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: 'system', label: 'Системная', icon: Monitor },
  { value: 'dark', label: 'Тёмная', icon: Moon },
  { value: 'light', label: 'Светлая', icon: Sun }
];

export function SettingsPage() {
  const settings = useAppStore((s) => s.settings)!;
  const update = useAppStore((s) => s.updateSettings);
  const showToast = useAppStore((s) => s.showToast);
  const activeFlight = useAppStore((s) => s.activeFlight);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [blockStatus, setBlockStatus] = useState<{ hostsBlockPresent: boolean; hostsPath: string } | null>(null);
  const [clearing, setClearing] = useState(false);
  const isWindows = navigator.userAgent.includes('Windows');

  const refreshBlockStatus = () => {
    void getApi()
      .getBlockStatus()
      .then(setBlockStatus)
      .catch(() => setBlockStatus(null));
  };
  useEffect(refreshBlockStatus, [activeFlight?.blocking.sitesActive]);

  const clearBlocks = async () => {
    setClearing(true);
    const result = await getApi().clearSiteBlocks();
    setClearing(false);
    refreshBlockStatus();
    showToast(result.ok ? 'Блокировка удалена из файла hosts.' : result.error, result.ok ? 'info' : 'error');
  };

  return (
    <div className="animate-enter mx-auto max-w-[920px] px-12 pb-14 pt-2">
      <PageHeader eyebrow="Параметры" title="Настройки" description="Изменения сохраняются автоматически." />

      <div className="mt-8">
        <Section title="Рейсы" description="Выбирается по умолчанию на экране вылета.">
          <div>
            <div className="mb-2.5 text-[14px] font-medium">Время полёта по умолчанию</div>
            <DurationPicker
              value={settings.defaultDurationMin}
              error={durationError}
              onChange={(m) => {
                const v = validateDuration(m);
                setDurationError(v.ok ? null : v.error);
                if (v.ok) {
                  void update({ defaultDurationMin: v.value });
                  if (!activeFlight) useAppStore.getState().setDraft({ durationMin: v.value });
                }
              }}
            />
          </div>
        </Section>

        <Section
          title="Чёрный список сайтов"
          description="Во время полёта эти сайты блокируются во всех браузерах через системный файл hosts."
        >
          <Row
            title="Блокировать сайты по умолчанию"
            control={
              <Toggle
                label="Блокировать сайты по умолчанию"
                checked={settings.blockSitesByDefault}
                onChange={(v) => void update({ blockSitesByDefault: v })}
              />
            }
          />
          <ListEditor
            items={settings.blockedSites}
            onChange={(blockedSites) => void update({ blockedSites })}
            normalize={normalizeDomain}
            placeholder="Добавьте домен, например vk.com"
            invalidMessage="Это не похоже на адрес сайта."
            emptyMessage="В списке нет сайтов."
          />
          {activeFlight?.blocking.sitesActive && (
            <p className="text-[13px] text-faint">Изменения списка вступят в силу со следующего рейса.</p>
          )}
          <div className="rounded-xl bg-raised/60 p-4 text-[13px] leading-relaxed text-muted">
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="font-medium text-ink">Разрешение на изменение hosts: </span>
                {settings.hostsConsent ? 'выдано' : 'ещё не выдано — мы спросим перед первым рейсом с блокировкой'}
                {blockStatus && (
                  <div className="mt-1">
                    Блокировка сейчас {blockStatus.hostsBlockPresent ? 'присутствует' : 'отсутствует'} в{' '}
                    <span className="font-mono text-[12px]">{blockStatus.hostsPath}</span>
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {settings.hostsConsent && (
                  <Button size="sm" variant="ghost" onClick={() => void update({ hostsConsent: false })}>
                    Отозвать
                  </Button>
                )}
                {blockStatus?.hostsBlockPresent && (
                  <Button size="sm" loading={clearing} onClick={() => void clearBlocks()}>
                    Снять блокировку
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Приложения"
          description={
            isWindows
              ? 'Программы из списка закрываются, если запущены во время полёта. Несохранённые данные в них теряются.'
              : 'Блокировка приложений доступна в Windows.'
          }
        >
          <Row
            title="Закрывать приложения по умолчанию"
            control={
              <Toggle
                label="Закрывать приложения по умолчанию"
                disabled={!isWindows}
                checked={settings.blockAppsByDefault}
                onChange={(v) => void update({ blockAppsByDefault: v })}
              />
            }
          />
          <ListEditor
            items={settings.blockedApps}
            onChange={(blockedApps) => void update({ blockedApps })}
            normalize={normalizeExeName}
            placeholder="Добавьте программу, например Discord.exe"
            invalidMessage="Укажите имя файла программы, например Discord.exe."
            emptyMessage="В списке нет приложений."
            disabled={!isWindows}
          />
        </Section>

        <Section title="Звук" description="Сигналы при взлёте и посадке и тихий шум салона по желанию.">
          <Row
            title="Звуки"
            control={
              <Toggle label="Звуки" checked={settings.sound.enabled} onChange={(v) => void update({ sound: { ...settings.sound, enabled: v } })} />
            }
          />
          <Row
            title="Громкость"
            control={
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  aria-label="Громкость"
                  disabled={!settings.sound.enabled}
                  value={Math.round(settings.sound.volume * 100)}
                  onChange={(e) => void update({ sound: { ...settings.sound, volume: Number(e.target.value) / 100 } })}
                  className="w-40 accent-[rgb(var(--accent))] disabled:opacity-40"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Volume2 size={14} />}
                  disabled={!settings.sound.enabled}
                  onClick={() => playChime('preview', settings.sound.volume)}
                >
                  Проверить
                </Button>
              </div>
            }
          />
          <Row
            title="Шум салона"
            hint="Мягкий низкочастотный фон во время полёта."
            control={
              <Toggle
                label="Шум салона"
                disabled={!settings.sound.enabled}
                checked={settings.sound.cabinAmbience}
                onChange={(v) => void update({ sound: { ...settings.sound, cabinAmbience: v } })}
              />
            }
          />
        </Section>

        <Section title="Уведомления" description="Уведомления Windows — видны, даже когда Flight Mode свёрнут.">
          <Row
            title="При посадке"
            control={
              <Toggle
                label="Уведомлять при посадке"
                checked={settings.notifications.onLanding}
                onChange={(v) => void update({ notifications: { ...settings.notifications, onLanding: v } })}
              />
            }
          />
          <Row
            title="При взлёте"
            control={
              <Toggle
                label="Уведомлять при взлёте"
                checked={settings.notifications.onTakeoff}
                onChange={(v) => void update({ notifications: { ...settings.notifications, onTakeoff: v } })}
              />
            }
          />
          <Row
            title="На полпути"
            hint="Напоминание отметить чек-лист: при полёте на 40 минут — через 20, на 30 — через 15. Паузы не считаются."
            control={
              <Toggle
                label="Напоминать на полпути"
                checked={settings.notifications.onHalfway}
                onChange={(v) => void update({ notifications: { ...settings.notifications, onHalfway: v } })}
              />
            }
          />
          <Row
            title="При турбулентности"
            hint="Когда во время полёта закрыто приложение из списка."
            control={
              <Toggle
                label="Уведомлять при турбулентности"
                checked={settings.notifications.onTurbulence}
                onChange={(v) => void update({ notifications: { ...settings.notifications, onTurbulence: v } })}
              />
            }
          />
        </Section>

        <Section title="Оформление">
          <div className="inline-flex rounded-xl bg-raised p-1" role="radiogroup" aria-label="Тема">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={settings.theme === value}
                onClick={() => void update({ theme: value })}
                className={cx(
                  'flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-medium transition-colors',
                  settings.theme === value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                )}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
