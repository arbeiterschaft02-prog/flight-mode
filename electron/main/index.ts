import { app, BrowserWindow, nativeTheme, powerMonitor } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { FlightEvent } from '../../src/types';
import { FlightService } from './flightService';
import { IPC, registerIpc } from './ipc';
import { setNotificationIcon } from './notifier';
import { DataStore } from './store';
import { createMainWindow } from './window';

const APP_ID = 'com.flightmode.app';

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow: BrowserWindow | null = null;

  const resolveIcon = (): string | undefined => {
    const candidates = [
      path.join(process.resourcesPath ?? '', 'icon.png'),
      path.join(__dirname, '../../resources/icon.png')
    ];
    return candidates.find((p) => fs.existsSync(p));
  };

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    app.setAppUserModelId(APP_ID);
    const iconPath = resolveIcon();
    setNotificationIcon(iconPath);

    const store = new DataStore(app.getPath('userData'));
    nativeTheme.themeSource = store.get().settings.theme;

    const emit = (event: FlightEvent) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send(IPC.flightEvent, event);
      }
    };
    const flights = new FlightService(store, emit);
    registerIpc(store, flights);

    try {
      await flights.recover();
    } catch (err) {
      console.error('[main] Flight recovery failed:', err);
    }

    powerMonitor.on('resume', () => flights.onSystemResume());
    powerMonitor.on('unlock-screen', () => flights.onSystemResume());
    app.on('before-quit', () => flights.dispose());

    mainWindow = createMainWindow({ iconPath, hasActiveFlight: () => store.get().activeFlight !== null });
    mainWindow.on('closed', () => (mainWindow = null));

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createMainWindow({ iconPath, hasActiveFlight: () => store.get().activeFlight !== null });
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
