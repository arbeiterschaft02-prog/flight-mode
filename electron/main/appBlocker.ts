import { execFile } from 'node:child_process';

/**
 * Application blocking: while a flight is active, poll the running processes
 * of the current user and close any executable on the user's block list.
 *
 * Uses the built-in `tasklist` / `taskkill` tools, which need no extra
 * permissions for processes owned by the same user. Apps launched elevated
 * (as administrator) cannot be closed this way and are reported as such.
 */

const POLL_MS = 4000;

function exec(file: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 15_000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) =>
      err ? reject(err) : resolve(String(stdout))
    );
  });
}

/** Parses `tasklist /fo csv /nh` output into lower-cased image names. */
export function parseTasklist(csv: string): Set<string> {
  const names = new Set<string>();
  for (const line of csv.split(/\r?\n/)) {
    const match = /^"([^"]+)"/.exec(line.trim());
    if (match) names.add(match[1].toLowerCase());
  }
  return names;
}

export class AppBlocker {
  private timer: NodeJS.Timeout | null = null;
  private blocked: string[] = [];
  private busy = false;
  private readonly onClosed: (app: string) => void;

  constructor(onClosed: (app: string) => void) {
    this.onClosed = onClosed;
  }

  get supported(): boolean {
    return process.platform === 'win32';
  }

  start(apps: string[]): boolean {
    this.stop();
    if (!this.supported || apps.length === 0) return false;
    this.blocked = apps;
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), POLL_MS);
    return true;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.blocked = [];
  }

  private async sweep(): Promise<void> {
    if (this.busy || this.blocked.length === 0) return;
    this.busy = true;
    try {
      const running = parseTasklist(await exec('tasklist', ['/fo', 'csv', '/nh']));
      for (const app of this.blocked) {
        if (!running.has(app.toLowerCase())) continue;
        try {
          await exec('taskkill', ['/im', app, '/t', '/f']);
          this.onClosed(app);
        } catch (err) {
          console.warn(`[appBlocker] Could not close ${app}:`, err);
        }
      }
    } catch (err) {
      console.warn('[appBlocker] Process scan failed:', err);
    } finally {
      this.busy = false;
    }
  }
}
