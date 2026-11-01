import type { FlightModeApi } from '@/types';

declare global {
  interface Window {
    flightMode?: FlightModeApi;
  }
}

/**
 * The renderer's only gateway to the system. Everything privileged (files,
 * hosts, processes, notifications) happens in the main process behind IPC.
 */
export function getApi(): FlightModeApi {
  if (!window.flightMode) {
    throw new Error('Flight Mode должен запускаться как настольное приложение (нет моста preload).');
  }
  return window.flightMode;
}

export function unwrap<T>(result: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}
