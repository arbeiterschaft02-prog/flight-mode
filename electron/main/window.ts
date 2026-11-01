import { BrowserWindow, dialog, nativeTheme, shell } from 'electron';
import path from 'node:path';

const OVERLAY = {
  dark: { color: '#070c18', symbolColor: '#c9d4e8' },
  light: { color: '#f4f6fa', symbolColor: '#1b2a47' }
};

export function overlayFor(dark: boolean) {
  return { ...(dark ? OVERLAY.dark : OVERLAY.light), height: 44 };
}

export function createMainWindow(opts: {
  iconPath: string | undefined;
  hasActiveFlight: () => boolean;
}): BrowserWindow {
  const dark = nativeTheme.shouldUseDarkColors;
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 940,
    minHeight: 640,
    show: false,
    title: 'Flight Mode',
    icon: opts.iconPath,
    backgroundColor: dark ? OVERLAY.dark.color : OVERLAY.light.color,
    titleBarStyle: 'hidden',
    titleBarOverlay: overlayFor(dark),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  // 'ready-to-show' is not guaranteed to fire for a hidden window, so fall
  // back to showing shortly after the page has loaded.
  let shown = false;
  const reveal = () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    win.show();
  };
  win.once('ready-to-show', reveal);
  win.webContents.once('did-finish-load', () => setTimeout(reveal, 600));
  setTimeout(reveal, 5000);

  const updateOverlay = () => {
    if (win.isDestroyed()) return;
    const isDark = nativeTheme.shouldUseDarkColors;
    win.setTitleBarOverlay?.(overlayFor(isDark));
    win.setBackgroundColor(isDark ? OVERLAY.dark.color : OVERLAY.light.color);
  };
  nativeTheme.on('updated', updateOverlay);
  win.on('closed', () => nativeTheme.off('updated', updateOverlay));

  // External links open in the default browser; the app never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) event.preventDefault();
  });

  // Closing during a flight is always allowed — we only explain what happens.
  win.on('close', (event) => {
    if (!opts.hasActiveFlight()) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      title: 'Рейс в процессе',
      message: 'Вы всё ещё в полёте.',
      detail:
        'Если закрыть Flight Mode, отсчёт продолжится, а блокировка сайтов останется. ' +
        'При следующем запуске рейс продолжится — или завершится, если время уже вышло.\n\n' +
        'Чтобы закончить сессию сейчас, используйте «Аварийную посадку».',
      buttons: ['Свернуть', 'Закрыть приложение', 'Отмена'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    });
    if (choice === 1) return;
    event.preventDefault();
    if (choice === 0) win.minimize();
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  return win;
}
