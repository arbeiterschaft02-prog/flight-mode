import { app, ipcMain, nativeTheme } from 'electron';
import type { AppSnapshot, Result, Settings, StartFlightInput } from '../../src/types';
import type { FlightService } from './flightService';
import { HOSTS_PATH, isBlockPresent } from './siteBlocker';
import { sanitizeSettings, type DataStore } from './store';

export const IPC = {
  getSnapshot: 'fm:get-snapshot',
  updateSettings: 'fm:update-settings',
  startFlight: 'fm:start-flight',
  pauseFlight: 'fm:pause-flight',
  resumeFlight: 'fm:resume-flight',
  emergencyLanding: 'fm:emergency-landing',
  checkLanding: 'fm:check-landing',
  deleteRecord: 'fm:delete-record',
  clearSiteBlocks: 'fm:clear-site-blocks',
  getBlockStatus: 'fm:get-block-status',
  flightEvent: 'fm:flight-event'
} as const;

const guard =
  <A extends unknown[], T>(fn: (...args: A) => Promise<Result<T>> | Result<T>) =>
  async (_e: Electron.IpcMainInvokeEvent, ...args: A): Promise<Result<T>> => {
    try {
      return await fn(...args);
    } catch (err) {
      console.error('[ipc]', err);
      return { ok: false, error: err instanceof Error ? err.message : 'Непредвиденная ошибка.' };
    }
  };

export function registerIpc(store: DataStore, flights: FlightService): void {
  ipcMain.handle(IPC.getSnapshot, (): AppSnapshot => {
    const { settings, history, activeFlight } = store.get();
    const recovery = flights.recovery;
    flights.recovery = null; // Shown once.
    return { settings, history, activeFlight, recovery, platform: process.platform, appVersion: app.getVersion() };
  });

  ipcMain.handle(
    IPC.updateSettings,
    guard((patch: Partial<Settings>) => {
      const current = store.get().settings;
      const merged = sanitizeSettings(
        {
          ...current,
          ...patch,
          sound: { ...current.sound, ...(patch?.sound ?? {}) },
          notifications: { ...current.notifications, ...(patch?.notifications ?? {}) }
        },
        current
      );
      store.update((d) => {
        d.settings = merged;
      });
      nativeTheme.themeSource = merged.theme;
      return { ok: true, data: merged };
    })
  );

  ipcMain.handle(IPC.startFlight, guard((input: StartFlightInput) => flights.start(input)));
  ipcMain.handle(IPC.pauseFlight, guard(() => flights.pause()));
  ipcMain.handle(IPC.resumeFlight, guard(() => flights.resume()));
  ipcMain.handle(IPC.emergencyLanding, guard(() => flights.emergencyLanding()));
  ipcMain.handle(IPC.checkLanding, guard(() => flights.checkLanding()));
  ipcMain.handle(IPC.clearSiteBlocks, guard(() => flights.clearSiteBlocks()));

  ipcMain.handle(
    IPC.deleteRecord,
    guard((id: string) => {
      if (typeof id !== 'string') return { ok: false, error: 'Неверный идентификатор записи.' };
      const data = store.update((d) => {
        d.history = d.history.filter((r) => r.id !== id);
      });
      return { ok: true, data: data.history };
    })
  );

  ipcMain.handle(IPC.getBlockStatus, async () => ({ hostsBlockPresent: await isBlockPresent(), hostsPath: HOSTS_PATH }));}
