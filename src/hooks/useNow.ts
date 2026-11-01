import { useEffect, useState } from 'react';

/**
 * Re-renders on an interval and returns Date.now(). The interval only drives
 * repaints — every value shown is computed from the timestamp, so a throttled
 * or suspended window catches up instantly when it becomes visible again.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, [intervalMs, enabled]);

  return now;
}
