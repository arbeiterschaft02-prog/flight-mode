import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expandDomain } from '../../src/utils/domains.ts';

/**
 * Website blocking via the Windows hosts file.
 *
 * Why the hosts file: it is the only mechanism that works across every
 * browser without installing an extension or a network driver. Writing it
 * needs administrator rights, so when the app is not elevated we write the new
 * content to a temp file and copy it into place through a one-off elevated
 * PowerShell process — Windows shows a UAC prompt the user can decline.
 *
 * Every change is verified by reading the hosts file back; callers are only
 * told blocking is active when the block is actually present.
 */

export const HOSTS_PATH =
  process.platform === 'win32'
    ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts')
    : '/etc/hosts';

const START_MARKER = '# >>> Flight Mode: focus block (managed automatically, removed after landing)';
const END_MARKER = '# <<< Flight Mode: end of focus block';

export function stripBlock(content: string): string {
  const lines = content.split(/\r?\n/);
  const out: string[] = [];
  let inside = false;
  for (const line of lines) {
    if (line.trim() === START_MARKER) {
      inside = true;
      continue;
    }
    if (line.trim() === END_MARKER) {
      inside = false;
      continue;
    }
    if (!inside) out.push(line);
  }
  while (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  return out.join('\r\n') + '\r\n';
}

export function buildHostsContent(original: string, domains: string[]): string {
  const base = stripBlock(original);
  if (domains.length === 0) return base;
  const hosts = [...new Set(domains.flatMap(expandDomain))];
  const lines = [START_MARKER, ...hosts.flatMap((h) => [`0.0.0.0 ${h}`, `:: ${h}`]), END_MARKER];
  return `${base}\r\n${lines.join('\r\n')}\r\n`;
}

export function hasBlock(content: string): boolean {
  return content.split(/\r?\n/).some((l) => l.trim() === START_MARKER);
}

async function readHosts(): Promise<string> {
  try {
    return await fs.readFile(HOSTS_PATH, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw err;
  }
}

export async function isBlockPresent(): Promise<boolean> {
  try {
    return hasBlock(await readHosts());
  } catch {
    return false;
  }
}

function run(file: string, args: string[]): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout: 120_000 }, (error, _stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
      resolve({ code, stderr: String(stderr ?? '') });
    });
  });
}

const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;

/*
 * A running Chromium browser re-reads the hosts file when it changes, but one
 * that has been open for days can stop noticing and keep resolving names on
 * its own until it is restarted. Nothing outside the browser fixes that state
 * reliably, so the flight deck tells the user to restart the browser instead.
 */

async function writeHostsElevated(content: string): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('Для изменения файла hosts нужны права администратора.');
  }
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'flight-mode-'));
  const contentFile = path.join(dir, 'hosts.new');
  const scriptFile = path.join(dir, 'apply.ps1');
  try {
    await fs.writeFile(contentFile, content, 'utf8');
    await fs.writeFile(
      scriptFile,
      [
        "$ErrorActionPreference = 'Stop'",
        `$target = ${psQuote(HOSTS_PATH)}`,
        'if (Test-Path -LiteralPath $target) { (Get-Item -LiteralPath $target).IsReadOnly = $false }',
        `Copy-Item -LiteralPath ${psQuote(contentFile)} -Destination $target -Force`,
        'ipconfig /flushdns | Out-Null',
        'exit 0'
      ].join('\r\n'),
      'utf8'
    );
    const command =
      `try { $p = Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -Wait -PassThru ` +
      `-ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',${psQuote(`"${scriptFile}"`)}; exit $p.ExitCode } ` +
      `catch { exit 1223 }`;
    const result = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command]);
    if (result.code === 1223) throw new Error('Запрос прав администратора отклонён.');
    if (result.code !== 0) throw new Error(`Не удалось обновить файл hosts (код ${result.code}).`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function writeHosts(content: string): Promise<void> {
  try {
    await fs.writeFile(HOSTS_PATH, content, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM' || code === 'EACCES') {
      await writeHostsElevated(content);
      return;
    }
    throw err;
  }
  // Direct write succeeded, so we are already elevated.
  if (process.platform === 'win32') await run('ipconfig', ['/flushdns']);
}

export interface BlockResult {
  ok: boolean;
  error: string | null;
}

export async function applySiteBlock(domains: string[]): Promise<BlockResult> {
  if (domains.length === 0) return { ok: false, error: 'Список сайтов для блокировки пуст.' };
  try {
    const original = await readHosts();
    await writeHosts(buildHostsContent(original, domains));
    const verified = hasBlock(await readHosts());
    return verified
      ? { ok: true, error: null }
      : { ok: false, error: 'Файл hosts не принял изменения (возможно, его защищает антивирус).' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function removeSiteBlock(): Promise<BlockResult> {
  try {
    const original = await readHosts();
    if (!hasBlock(original)) return { ok: true, error: null };
    await writeHosts(stripBlock(original));
    const stillThere = hasBlock(await readHosts());
    return stillThere ? { ok: false, error: 'Блокировка всё ещё присутствует в файле hosts.' } : { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
