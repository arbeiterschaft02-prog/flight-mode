/** The interface is in Russian, so dates follow it rather than the OS locale. */
export const UI_LOCALE = 'ru-RU';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const pad = (n: number) => String(n).padStart(2, '0');

/** Countdown display: "24:59" or "1:04:59". Rounds up so "0:00" only shows at landing. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Human duration: "1 ч 25 мин", "25 мин", "40 с". */
export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  if (totalSec < 60) return `${totalSec} с`;
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

export function formatTimeOfDay(epoch: number): string {
  return new Date(epoch).toLocaleTimeString(UI_LOCALE, { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(epoch: number): string {
  return new Date(epoch).toLocaleDateString(UI_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Local calendar day key, e.g. "2026-11-01". */
export function dayKey(epoch: number): string {
  const d = new Date(epoch);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(epoch: number): number {
  const d = new Date(epoch);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function relativeDayLabel(epoch: number, now: number): string {
  const diff = Math.round((startOfDay(now) - startOfDay(epoch)) / 86_400_000);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  return capitalize(new Date(epoch).toLocaleDateString(UI_LOCALE, { weekday: 'long', day: 'numeric', month: 'long' }));
}

/** Short weekday, e.g. "Пн". */
export function weekdayShort(epoch: number): string {
  return capitalize(new Date(epoch).toLocaleDateString(UI_LOCALE, { weekday: 'short' }));
}

export function greeting(now: number): string {
  const h = new Date(now).getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}
