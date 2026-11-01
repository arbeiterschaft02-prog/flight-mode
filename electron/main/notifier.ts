import { Notification } from 'electron';

let iconPath: string | undefined;

export function setNotificationIcon(path: string | undefined): void {
  iconPath = path;
}

export function notify(title: string, body: string): void {
  if (!Notification.isSupported()) return;
  try {
    new Notification({ title, body, icon: iconPath, silent: true }).show();
  } catch (err) {
    console.warn('[notifier] Notification failed:', err);
  }
}
