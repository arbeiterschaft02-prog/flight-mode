import { useEffect } from 'react';
import { startAmbience, stopAmbience } from '@/services/sound';
import type { Settings } from '@/types';

export function useCabinAmbience(active: boolean, sound: Settings['sound'] | undefined): void {
  const on = active && !!sound?.enabled && !!sound.cabinAmbience;
  const volume = sound?.volume ?? 0;

  useEffect(() => {
    if (on) startAmbience(volume);
    else stopAmbience();
  }, [on, volume]);

  useEffect(() => () => stopAmbience(), []);
}
