import type { FlightRecord } from '../types/index.ts';
import { dayKey, startOfDay } from './time.ts';

export interface DayTotal {
  key: string;
  start: number;
  focusMs: number;
  flights: number;
}

export interface FlightStats {
  today: { focusMs: number; completed: number; interrupted: number };
  totalFocusMs: number;
  completed: number;
  interrupted: number;
  /** 0..1, or null when there is no history. */
  completionRate: number | null;
  averageFocusMs: number;
  longestFocusMs: number;
  /** Consecutive days (ending today or yesterday) with at least one completed flight. */
  streakDays: number;
  lastDays: DayTotal[];
}

export function computeStats(history: FlightRecord[], now: number, days = 7): FlightStats {
  const todayKey = dayKey(now);
  const byDay = new Map<string, { focusMs: number; flights: number; completed: number }>();
  let totalFocusMs = 0;
  let completed = 0;
  let interrupted = 0;
  let longestFocusMs = 0;
  const today = { focusMs: 0, completed: 0, interrupted: 0 };

  for (const r of history) {
    totalFocusMs += r.focusedMs;
    longestFocusMs = Math.max(longestFocusMs, r.focusedMs);
    if (r.outcome === 'completed') completed++;
    else interrupted++;

    const key = dayKey(r.startedAt);
    const day = byDay.get(key) ?? { focusMs: 0, flights: 0, completed: 0 };
    day.focusMs += r.focusedMs;
    day.flights++;
    if (r.outcome === 'completed') day.completed++;
    byDay.set(key, day);

    if (key === todayKey) {
      today.focusMs += r.focusedMs;
      if (r.outcome === 'completed') today.completed++;
      else today.interrupted++;
    }
  }

  const lastDays: DayTotal[] = [];
  const todayStart = startOfDay(now);
  for (let i = days - 1; i >= 0; i--) {
    // Step via Date to stay correct across DST changes.
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const key = dayKey(d.getTime());
    const day = byDay.get(key);
    lastDays.push({ key, start: d.getTime(), focusMs: day?.focusMs ?? 0, flights: day?.flights ?? 0 });
  }

  let streakDays = 0;
  const cursor = new Date(todayStart);
  if (!byDay.get(dayKey(cursor.getTime()))?.completed) cursor.setDate(cursor.getDate() - 1);
  while (byDay.get(dayKey(cursor.getTime()))?.completed) {
    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const total = completed + interrupted;
  return {
    today,
    totalFocusMs,
    completed,
    interrupted,
    completionRate: total > 0 ? completed / total : null,
    averageFocusMs: total > 0 ? totalFocusMs / total : 0,
    longestFocusMs,
    streakDays,
    lastDays
  };
}
