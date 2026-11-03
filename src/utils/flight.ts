/**
 * Timestamp-based flight clock. Nothing here counts ticks: every value is
 * derived from Date.now() and the stored timestamps, so the countdown stays
 * correct across minimising, system sleep and application restarts.
 */
import {
  MAX_DURATION_MIN,
  MAX_TASK_LENGTH,
  MIN_DURATION_MIN,
  type ActiveFlight
} from '../types/index.ts';

export function pausedMs(flight: ActiveFlight, now: number): number {
  const current = flight.pausedAt !== null ? Math.max(0, now - flight.pausedAt) : 0;
  return flight.pausedTotalMs + current;
}

export function elapsedMs(flight: ActiveFlight, now: number): number {
  const raw = now - flight.startedAt - pausedMs(flight, now);
  return Math.min(flight.plannedDurationMs, Math.max(0, raw));
}

export function remainingMs(flight: ActiveFlight, now: number): number {
  return Math.max(0, flight.plannedDurationMs - elapsedMs(flight, now));
}

export function progress(flight: ActiveFlight, now: number): number {
  if (flight.plannedDurationMs <= 0) return 1;
  return elapsedMs(flight, now) / flight.plannedDurationMs;
}

/**
 * Focused time left until the halfway point (0 once it is reached). A 40-minute
 * flight reaches it after 20 focused minutes; pauses do not count.
 */
export function untilHalfwayMs(flight: ActiveFlight, now: number): number {
  return Math.max(0, flight.plannedDurationMs / 2 - elapsedMs(flight, now));
}

/** Wall-clock time at which the flight will land if not paused again. */
export function estimatedArrival(flight: ActiveFlight, now: number): number {
  return now + remainingMs(flight, now);
}

export type FlightPhase = 'takeoff' | 'climb' | 'cruise' | 'descent' | 'approach' | 'holding';

export function flightPhase(flight: ActiveFlight, now: number): FlightPhase {
  if (flight.pausedAt !== null) return 'holding';
  const p = progress(flight, now);
  if (p < 0.04) return 'takeoff';
  if (p < 0.15) return 'climb';
  if (p < 0.85) return 'cruise';
  if (p < 0.97) return 'descent';
  return 'approach';
}

export function validateTaskName(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.replace(/\s+/g, ' ').trim();
  if (!value) return { ok: false, error: 'Назовите задачу — пункт назначения рейса.' };
  if (value.length < 2) return { ok: false, error: 'Название задачи слишком короткое.' };
  if (value.length > MAX_TASK_LENGTH) {
    return { ok: false, error: `Не длиннее ${MAX_TASK_LENGTH} символов.` };
  }
  return { ok: true, value };
}

export function validateDuration(minutes: number): { ok: true; value: number } | { ok: false; error: string } {
  if (!Number.isFinite(minutes)) return { ok: false, error: 'Укажите длительность в минутах.' };
  const value = Math.round(minutes);
  if (value < MIN_DURATION_MIN || value > MAX_DURATION_MIN) {
    return { ok: false, error: `Выберите от ${MIN_DURATION_MIN} до ${MAX_DURATION_MIN} минут.` };
  }
  return { ok: true, value };
}

/** Stable "FM 482"-style flight number derived from the flight id. */
export function flightNumberFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `FM ${100 + (hash % 900)}`;
}
