import { useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { ActiveFlight } from '@/types';
import { elapsedMs, estimatedArrival, flightPhase, progress, remainingMs } from '@/utils/flight';
import { useNow } from './useNow';

/** Live, timestamp-derived view of the active flight. */
export function useFlightClock(flight: ActiveFlight | null) {
  const now = useNow(250, flight !== null);
  const checkLanding = useAppStore((s) => s.checkLanding);
  const lastCheck = useRef(0);

  const remaining = flight ? remainingMs(flight, now) : 0;
  const paused = flight?.pausedAt != null;

  // The main process owns the landing timer; this is a belt-and-braces check
  // in case the window notices zero first (e.g. right after waking from sleep).
  useEffect(() => {
    if (!flight || paused || remaining > 0) return;
    if (now - lastCheck.current < 1000) return;
    lastCheck.current = now;
    void checkLanding();
  }, [flight, paused, remaining, now, checkLanding]);

  if (!flight) return null;
  return {
    now,
    remaining,
    elapsed: elapsedMs(flight, now),
    progress: progress(flight, now),
    phase: flightPhase(flight, now),
    eta: estimatedArrival(flight, now),
    paused
  };
}
